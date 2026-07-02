package service

import (
	"bytes"
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"io"
	"log"
	"mime"
	"net"
	"net/mail"
	"net/smtp"
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
		return fmt.Errorf("smtp quit: %w", err)
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
	fromHeader := fromAddress.String()
	toHeader := toAddress.String()
	subject := mime.QEncoding.Encode("UTF-8", "Sauna 登录验证码")
	minutes := int(ttl.Round(time.Minute).Minutes())
	if minutes <= 0 {
		minutes = 10
	}
	body := fmt.Sprintf("你的 Sauna 登录验证码是：%s\n\n%d 分钟内有效。若不是你本人操作，请忽略这封邮件。\n", code, minutes)

	var message bytes.Buffer
	fmt.Fprintf(&message, "From: %s\r\n", fromHeader)
	fmt.Fprintf(&message, "To: %s\r\n", toHeader)
	fmt.Fprintf(&message, "Subject: %s\r\n", subject)
	fmt.Fprintf(&message, "MIME-Version: 1.0\r\n")
	fmt.Fprintf(&message, "Content-Type: text/plain; charset=UTF-8\r\n")
	fmt.Fprintf(&message, "Content-Transfer-Encoding: 8bit\r\n")
	fmt.Fprintf(&message, "\r\n%s", body)
	return message.Bytes(), nil
}
