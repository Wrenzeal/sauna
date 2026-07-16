package service

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"html"
	"io"
	"log"
	"mime"
	"mime/multipart"
	"mime/quotedprintable"
	"net"
	"net/mail"
	"net/smtp"
	"net/textproto"
	"strconv"
	"strings"
	"time"
)

const defaultSMTPTimeout = 15 * time.Second

// EmailSender sends one-time authentication codes. AuthService depends on this
// interface instead of a concrete SMTP implementation so tests and future
// providers can be swapped without touching the auth flow.
type EmailSender interface {
	SendVerificationCode(ctx context.Context, email string, code string, ttl time.Duration) error
}

type SMTPEmailConfig struct {
	Host     string
	Port     int
	Username string
	Password string
	From     string
	FromName string
	Security string
	Timeout  time.Duration
}

type SMTPEmailSender struct {
	config SMTPEmailConfig
}

type DevEmailSender struct{}

func NewEmailSender(driver string, smtpConfig SMTPEmailConfig, appEnv string) (EmailSender, error) {
	driver = strings.ToLower(strings.TrimSpace(driver))
	appEnv = strings.ToLower(strings.TrimSpace(appEnv))
	if driver == "" {
		if appEnv == "production" {
			driver = "smtp"
		} else {
			driver = "dev"
		}
	}
	switch driver {
	case "dev", "log":
		if appEnv == "production" {
			return nil, errors.New("AUTH_EMAIL_DRIVER=dev is not allowed in production")
		}
		return DevEmailSender{}, nil
	case "smtp":
		return NewSMTPEmailSender(smtpConfig)
	default:
		return nil, fmt.Errorf("unsupported AUTH_EMAIL_DRIVER %q", driver)
	}
}

func NewSMTPEmailSender(config SMTPEmailConfig) (*SMTPEmailSender, error) {
	config.Host = strings.TrimSpace(config.Host)
	config.Username = strings.TrimSpace(config.Username)
	config.From = strings.TrimSpace(config.From)
	config.FromName = strings.TrimSpace(config.FromName)
	config.Security = normalizeSMTPSecurity(config.Security, config.Port)
	if config.Port == 0 {
		config.Port = 587
	}
	if config.Timeout <= 0 {
		config.Timeout = defaultSMTPTimeout
	}
	if config.Host == "" {
		return nil, errors.New("SMTP_HOST is required")
	}
	if config.From == "" {
		return nil, errors.New("SMTP_FROM is required")
	}
	if _, err := mail.ParseAddress(config.From); err != nil {
		return nil, fmt.Errorf("SMTP_FROM is invalid: %w", err)
	}
	if config.Security != "tls" && config.Security != "starttls" && config.Security != "none" {
		return nil, fmt.Errorf("SMTP_SECURITY must be one of auto, tls, starttls, none")
	}
	return &SMTPEmailSender{config: config}, nil
}

func (DevEmailSender) SendVerificationCode(_ context.Context, email string, code string, ttl time.Duration) error {
	log.Printf("sauna auth verification code for %s: %s (expires in %s)", email, code, ttl.Round(time.Second))
	return nil
}

func (s *SMTPEmailSender) SendVerificationCode(ctx context.Context, email string, code string, ttl time.Duration) error {
	if s == nil {
		return errors.New("smtp email sender is not configured")
	}
	message, err := buildVerificationEmail(s.config.From, s.config.FromName, email, code, ttl)
	if err != nil {
		return err
	}
	ctx, cancel := context.WithTimeout(ctx, s.config.Timeout)
	defer cancel()

	client, err := s.connect(ctx)
	if err != nil {
		return err
	}
	defer client.Close()

	if strings.TrimSpace(s.config.Username) != "" {
		auth := smtp.PlainAuth("", s.config.Username, s.config.Password, s.config.Host)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}
	if err := client.Mail(s.config.From); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	if err := client.Rcpt(email); err != nil {
		return fmt.Errorf("smtp rcpt to: %w", err)
	}
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := io.Copy(writer, bytes.NewReader(message)); err != nil {
		_ = writer.Close()
		return fmt.Errorf("smtp write body: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("smtp close body: %w", err)
	}
	if err := client.Quit(); err != nil {
		// A successful DATA close means the SMTP server accepted the message.
		// QUIT only closes the session, so do not invalidate a code the user may receive.
		log.Printf("smtp quit after message acceptance: %v", err)
	}
	return nil
}

func (s *SMTPEmailSender) connect(ctx context.Context) (*smtp.Client, error) {
	addr := net.JoinHostPort(s.config.Host, strconv.Itoa(s.config.Port))
	tlsConfig := &tls.Config{ServerName: s.config.Host, MinVersion: tls.VersionTLS12}
	if s.config.Security == "tls" {
		conn, err := tls.DialWithDialer(&net.Dialer{Timeout: s.config.Timeout}, "tcp", addr, tlsConfig)
		if err != nil {
			return nil, fmt.Errorf("smtp tls dial: %w", err)
		}
		client, err := smtp.NewClient(conn, s.config.Host)
		if err != nil {
			_ = conn.Close()
			return nil, fmt.Errorf("smtp client: %w", err)
		}
		return client, nil
	}

	conn, err := (&net.Dialer{Timeout: s.config.Timeout}).DialContext(ctx, "tcp", addr)
	if err != nil {
		return nil, fmt.Errorf("smtp dial: %w", err)
	}
	client, err := smtp.NewClient(conn, s.config.Host)
	if err != nil {
		_ = conn.Close()
		return nil, fmt.Errorf("smtp client: %w", err)
	}
	if s.config.Security == "starttls" {
		if ok, _ := client.Extension("STARTTLS"); !ok {
			_ = client.Close()
			return nil, errors.New("smtp server does not support STARTTLS")
		}
		if err := client.StartTLS(tlsConfig); err != nil {
			_ = client.Close()
			return nil, fmt.Errorf("smtp starttls: %w", err)
		}
	}
	return client, nil
}

func normalizeSMTPSecurity(security string, port int) string {
	security = strings.ToLower(strings.TrimSpace(security))
	if security == "" || security == "auto" {
		if port == 465 {
			return "tls"
		}
		return "starttls"
	}
	return security
}

func buildVerificationEmail(from string, fromName string, to string, code string, ttl time.Duration) ([]byte, error) {
	if _, err := mail.ParseAddress(to); err != nil {
		return nil, fmt.Errorf("recipient email is invalid: %w", err)
	}
	fromAddress := mail.Address{Name: strings.TrimSpace(fromName), Address: from}
	toAddress := mail.Address{Address: to}
	subject := mime.QEncoding.Encode("UTF-8", fmt.Sprintf("Sauna 登录验证码：%s", code))
	minutes := int(ttl.Round(time.Minute).Minutes())
	if minutes <= 0 {
		minutes = 10
	}
	plainBody, htmlBody := verificationEmailBodies(code, minutes)

	var body bytes.Buffer
	alternative := multipart.NewWriter(&body)
	if err := writeEmailPart(alternative, "text/plain; charset=UTF-8", plainBody); err != nil {
		return nil, err
	}
	if err := writeEmailPart(alternative, "text/html; charset=UTF-8", htmlBody); err != nil {
		return nil, err
	}
	if err := alternative.Close(); err != nil {
		return nil, fmt.Errorf("close email multipart body: %w", err)
	}

	var message bytes.Buffer
	fmt.Fprintf(&message, "From: %s\r\n", fromAddress.String())
	fmt.Fprintf(&message, "To: %s\r\n", toAddress.String())
	fmt.Fprintf(&message, "Subject: %s\r\n", subject)
	fmt.Fprintf(&message, "MIME-Version: 1.0\r\n")
	fmt.Fprintf(&message, "Content-Type: multipart/alternative; boundary=%q\r\n", alternative.Boundary())
	fmt.Fprintf(&message, "\r\n")
	message.Write(body.Bytes())
	return message.Bytes(), nil
}

func writeEmailPart(writer *multipart.Writer, contentType string, content string) error {
	header := make(textproto.MIMEHeader)
	header.Set("Content-Type", contentType)
	header.Set("Content-Transfer-Encoding", "quoted-printable")
	part, err := writer.CreatePart(header)
	if err != nil {
		return fmt.Errorf("create email part %s: %w", contentType, err)
	}
	encoded := quotedprintable.NewWriter(part)
	if _, err := io.WriteString(encoded, content); err != nil {
		_ = encoded.Close()
		return fmt.Errorf("write email part %s: %w", contentType, err)
	}
	if err := encoded.Close(); err != nil {
		return fmt.Errorf("close email part %s: %w", contentType, err)
	}
	return nil
}

func verificationEmailBodies(code string, minutes int) (string, string) {
	safeCode := html.EscapeString(code)
	plain := fmt.Sprintf(`Sauna 登录验证码

你的私人桑拿房已准备好。

验证码：%s

验证码将在 %d 分钟后失效。请勿将验证码转发给任何人。
如果不是你本人发起登录，可以安全地忽略这封邮件。

Sauna
https://sauna.wrenzeal.top
`, code, minutes)

	htmlBody := fmt.Sprintf(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
  <title>Sauna 登录验证码</title>
</head>
<body style="margin:0;padding:0;background:#f4efe6;color:#2d211b;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI','PingFang SC','Microsoft YaHei',Arial,sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">使用此验证码登录你的 Sauna 私人智囊工作区。&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;&#847;&zwnj;&nbsp;</div>
  <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="width:100%%;background:#f4efe6;">
    <tr>
      <td align="center" style="padding:40px 16px;">
        <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="width:100%%;max-width:560px;">
          <tr>
            <td style="padding:0 8px 18px;">
              <table role="presentation" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="vertical-align:middle;">
                    <img src="https://sauna.wrenzeal.top/sauna-mark.png" width="42" height="42" alt="Sauna" style="display:block;width:42px;height:42px;border:0;border-radius:13px;background:#513426;">
                  </td>
                  <td style="padding-left:12px;vertical-align:middle;font-family:Georgia,'Times New Roman',serif;font-size:21px;font-weight:700;letter-spacing:-0.02em;color:#2d211b;">Sauna</td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td style="overflow:hidden;border:1px solid #dfd2c2;border-radius:28px;background:#fffaf2;box-shadow:0 18px 50px rgba(81,52,38,0.12);">
              <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0">
                <tr>
                  <td style="height:7px;background:#c4863b;font-size:0;line-height:0;">&nbsp;</td>
                </tr>
                <tr>
                  <td style="padding:42px 44px 18px;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:0.16em;color:#7c4b20;text-transform:uppercase;">Private access</div>
                    <h1 style="margin:15px 0 0;font-family:Georgia,'Times New Roman','Songti SC',serif;font-size:31px;line-height:1.25;font-weight:600;letter-spacing:-0.035em;color:#2d211b;">你的私人桑拿房<br>已准备好</h1>
                    <p style="margin:17px 0 0;font-size:15px;line-height:1.8;color:#765f52;">输入下面的验证码，继续与你的智囊团慢慢聊。</p>
                  </td>
                </tr>
                <tr>
                  <td style="padding:8px 44px 30px;">
                    <div style="border:1px solid #e4c79e;border-radius:20px;background:#f6e7d0;padding:25px 20px;text-align:center;">
                      <div style="font-size:11px;font-weight:700;letter-spacing:0.14em;color:#8a5928;text-transform:uppercase;">Verification code</div>
                      <div style="margin-top:10px;font-family:'SFMono-Regular',Consolas,'Liberation Mono',monospace;font-size:38px;line-height:1.2;font-weight:700;letter-spacing:0.22em;color:#513426;">%s</div>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td style="padding:0 44px 42px;">
                    <table role="presentation" width="100%%" cellspacing="0" cellpadding="0" border="0" style="border-top:1px solid #eadfd2;">
                      <tr>
                        <td style="padding-top:23px;font-size:13px;line-height:1.75;color:#806d62;">
                          验证码将在 <strong style="color:#513426;">%d 分钟</strong>后失效，请勿转发给任何人。<br>
                          如果不是你本人发起登录，可以安全地忽略这封邮件。
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:22px 16px 0;font-size:12px;line-height:1.7;color:#907e72;">
              Sauna · Personal AI Brain Trust<br>
              <span style="color:#a08d81;">sauna.wrenzeal.top</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`, safeCode, minutes)
	return plain, htmlBody
}

// NotificationEmailSender is used by the durable notification outbox. It is
// intentionally separate from EmailSender so authentication test doubles stay small.
type NotificationEmailSender interface {
	SendNotification(ctx context.Context, email string, subject string, textBody string, htmlBody string) error
}

func (DevEmailSender) SendNotification(_ context.Context, email string, subject string, textBody string, _ string) error {
	log.Printf("sauna notification email to %s: %s | %s", email, subject, strings.Join(strings.Fields(textBody), " "))
	return nil
}

func (s *SMTPEmailSender) SendNotification(ctx context.Context, email string, subject string, textBody string, htmlBody string) error {
	message, err := buildGenericEmail(s.config.From, s.config.FromName, email, subject, textBody, htmlBody)
	if err != nil {
		return err
	}
	return s.sendRawMessage(ctx, email, message)
}

func (s *SMTPEmailSender) sendRawMessage(ctx context.Context, email string, message []byte) error {
	ctx, cancel := context.WithTimeout(ctx, s.config.Timeout)
	defer cancel()
	client, err := s.connect(ctx)
	if err != nil {
		return err
	}
	defer client.Close()
	if strings.TrimSpace(s.config.Username) != "" {
		auth := smtp.PlainAuth("", s.config.Username, s.config.Password, s.config.Host)
		if err := client.Auth(auth); err != nil {
			return fmt.Errorf("smtp auth: %w", err)
		}
	}
	if err := client.Mail(s.config.From); err != nil {
		return fmt.Errorf("smtp mail from: %w", err)
	}
	if err := client.Rcpt(email); err != nil {
		return fmt.Errorf("smtp rcpt to: %w", err)
	}
	writer, err := client.Data()
	if err != nil {
		return fmt.Errorf("smtp data: %w", err)
	}
	if _, err := io.Copy(writer, bytes.NewReader(message)); err != nil {
		_ = writer.Close()
		return fmt.Errorf("smtp write body: %w", err)
	}
	if err := writer.Close(); err != nil {
		return fmt.Errorf("smtp close body: %w", err)
	}
	if err := client.Quit(); err != nil {
		log.Printf("smtp quit after notification acceptance: %v", err)
	}
	return nil
}

func buildGenericEmail(from, fromName, to, subject, textBody, htmlBody string) ([]byte, error) {
	if _, err := mail.ParseAddress(to); err != nil {
		return nil, fmt.Errorf("recipient email is invalid: %w", err)
	}
	if strings.TrimSpace(htmlBody) == "" {
		htmlBody = "<p>" + html.EscapeString(textBody) + "</p>"
	}
	var body bytes.Buffer
	alternative := multipart.NewWriter(&body)
	if err := writeEmailPart(alternative, "text/plain; charset=UTF-8", textBody); err != nil {
		return nil, err
	}
	if err := writeEmailPart(alternative, "text/html; charset=UTF-8", htmlBody); err != nil {
		return nil, err
	}
	if err := alternative.Close(); err != nil {
		return nil, err
	}
	var message bytes.Buffer
	fromAddress := mail.Address{Name: strings.TrimSpace(fromName), Address: from}
	toAddress := mail.Address{Address: to}
	fmt.Fprintf(&message, "From: %s\r\n", fromAddress.String())
	fmt.Fprintf(&message, "To: %s\r\n", toAddress.String())
	fmt.Fprintf(&message, "Subject: %s\r\n", mime.QEncoding.Encode("UTF-8", subject))
	fmt.Fprintf(&message, "MIME-Version: 1.0\r\nContent-Type: multipart/alternative; boundary=%q\r\n\r\n", alternative.Boundary())
	message.Write(body.Bytes())
	return message.Bytes(), nil
}
