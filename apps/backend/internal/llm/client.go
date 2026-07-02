package llm

import (
	"bufio"
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

type Message struct {
	Role    string `json:"role"`
	Content string `json:"content"`
}

type ChatRequest struct {
	BaseURL  string
	APIKey   string
	Model    string
	Messages []Message
}

type TokenUsage struct {
	PromptTokens     int `json:"prompt_tokens"`
	CompletionTokens int `json:"completion_tokens"`
	TotalTokens      int `json:"total_tokens"`
}

type Model struct {
	ID      string `json:"id"`
	Object  string `json:"object,omitempty"`
	Created int64  `json:"created,omitempty"`
	OwnedBy string `json:"owned_by,omitempty"`
}

type TestChatResult struct {
	OK        bool       `json:"ok"`
	Status    string     `json:"status"`
	Content   string     `json:"content"`
	LatencyMS int64      `json:"latency_ms"`
	Usage     TokenUsage `json:"usage"`
}

type Client interface {
	StreamChat(ctx context.Context, request ChatRequest, onDelta func(delta string) error) (TokenUsage, error)
}

type OpenAICompatibleClient struct {
	httpClient *http.Client
}

func NewOpenAICompatibleClient() *OpenAICompatibleClient {
	return &OpenAICompatibleClient{httpClient: &http.Client{Timeout: 2 * time.Minute}}
}

func (c *OpenAICompatibleClient) StreamChat(ctx context.Context, request ChatRequest, onDelta func(delta string) error) (TokenUsage, error) {
	if strings.TrimSpace(request.BaseURL) == "" || strings.TrimSpace(request.APIKey) == "" || strings.TrimSpace(request.Model) == "" {
		fallback := deterministicFallback(request.Messages)
		if err := emitChunked(fallback, onDelta); err != nil {
			return TokenUsage{}, err
		}
		return TokenUsage{CompletionTokens: len(strings.Fields(fallback)), TotalTokens: len(strings.Fields(fallback))}, nil
	}
	endpoint := strings.TrimRight(request.BaseURL, "/") + "/chat/completions"
	body := map[string]any{
		"model":    request.Model,
		"messages": request.Messages,
		"stream":   true,
	}
	encoded, err := json.Marshal(body)
	if err != nil {
		return TokenUsage{}, err
	}
	httpReq, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(encoded))
	if err != nil {
		return TokenUsage{}, err
	}
	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("Authorization", "Bearer "+request.APIKey)
	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return TokenUsage{}, err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		preview, _ := io.ReadAll(io.LimitReader(resp.Body, 2048))
		return TokenUsage{}, fmt.Errorf("llm status %d: %s", resp.StatusCode, string(preview))
	}
	return readChatResponse(resp.Body, resp.Header.Get("Content-Type"), onDelta)
}

func (c *OpenAICompatibleClient) ListModels(ctx context.Context, baseURL string, apiKey string) ([]Model, error) {
	if strings.TrimSpace(baseURL) == "" || strings.TrimSpace(apiKey) == "" {
		return nil, errors.New("base_url and api_key are required")
	}
	endpoint := strings.TrimRight(baseURL, "/") + "/models"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Accept", "application/json")
	req.Header.Set("Authorization", "Bearer "+apiKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("模型供应商暂时无法连接: %w", err)
	}
	defer resp.Body.Close()
	body, err := io.ReadAll(io.LimitReader(resp.Body, 1024*1024))
	if err != nil {
		return nil, fmt.Errorf("读取模型供应商响应失败: %w", err)
	}
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return nil, fmt.Errorf("模型供应商返回 HTTP %d: %s", resp.StatusCode, providerErrorPreview(body))
	}
	var payload struct {
		Data []Model `json:"data"`
	}
	if err := json.Unmarshal(body, &payload); err != nil {
		return nil, fmt.Errorf("模型供应商没有返回 OpenAI 兼容的 JSON 模型列表，请检查 Base URL 是否应以 /v1 结尾: %s", providerErrorPreview(body))
	}
	models := make([]Model, 0, len(payload.Data))
	for _, model := range payload.Data {
		if strings.TrimSpace(model.ID) == "" {
			continue
		}
		models = append(models, model)
	}
	if len(models) == 0 {
		return nil, errors.New("模型供应商响应中没有可用模型，请确认该 Key 有模型列表权限")
	}
	return models, nil
}

func providerErrorPreview(body []byte) string {
	preview := strings.TrimSpace(string(body))
	if preview == "" {
		return "empty response"
	}
	preview = strings.ReplaceAll(preview, "\n", " ")
	preview = strings.ReplaceAll(preview, "\r", " ")
	preview = strings.Join(strings.Fields(preview), " ")
	if len(preview) > 240 {
		preview = preview[:240] + "..."
	}
	return preview
}

func (c *OpenAICompatibleClient) TestChat(ctx context.Context, request ChatRequest) (TestChatResult, error) {
	started := time.Now()
	var content strings.Builder
	usage, err := c.StreamChat(ctx, request, func(delta string) error {
		_, err := content.WriteString(delta)
		return err
	})
	if err != nil {
		return TestChatResult{}, err
	}
	return TestChatResult{OK: true, Status: "ok", Content: content.String(), LatencyMS: time.Since(started).Milliseconds(), Usage: usage}, nil
}

func (c *OpenAICompatibleClient) TestProvider(ctx context.Context, baseURL string, apiKey string) error {
	if strings.TrimSpace(baseURL) == "" || strings.TrimSpace(apiKey) == "" {
		return errors.New("base_url and api_key are required")
	}
	endpoint := strings.TrimRight(baseURL, "/") + "/models"
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, endpoint, nil)
	if err != nil {
		return err
	}
	req.Header.Set("Authorization", "Bearer "+apiKey)
	resp, err := c.httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return fmt.Errorf("provider test status %d", resp.StatusCode)
	}
	return nil
}

func readChatResponse(body io.Reader, contentType string, onDelta func(delta string) error) (TokenUsage, error) {
	if strings.Contains(strings.ToLower(contentType), "application/json") {
		return readOpenAIJSON(body, onDelta)
	}
	return readOpenAIStream(body, onDelta)
}

func readOpenAIStream(body io.Reader, onDelta func(delta string) error) (TokenUsage, error) {
	scanner := bufio.NewScanner(body)
	scanner.Buffer(make([]byte, 1024), 1024*1024)
	usage := TokenUsage{}
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, ":") {
			continue
		}
		if !strings.HasPrefix(line, "data:") {
			continue
		}
		data := strings.TrimSpace(strings.TrimPrefix(line, "data:"))
		if data == "[DONE]" {
			break
		}
		var frame struct {
			Choices []struct {
				Delta struct {
					Content string `json:"content"`
				} `json:"delta"`
			} `json:"choices"`
			Usage *struct {
				PromptTokens     int `json:"prompt_tokens"`
				CompletionTokens int `json:"completion_tokens"`
				TotalTokens      int `json:"total_tokens"`
			} `json:"usage"`
		}
		if err := json.Unmarshal([]byte(data), &frame); err != nil {
			continue
		}
		if frame.Usage != nil {
			usage = TokenUsage{PromptTokens: frame.Usage.PromptTokens, CompletionTokens: frame.Usage.CompletionTokens, TotalTokens: frame.Usage.TotalTokens}
		}
		for _, choice := range frame.Choices {
			if choice.Delta.Content == "" {
				continue
			}
			if err := emitChunked(choice.Delta.Content, onDelta); err != nil {
				return usage, err
			}
		}
	}
	return usage, scanner.Err()
}

func readOpenAIJSON(body io.Reader, onDelta func(delta string) error) (TokenUsage, error) {
	payload, err := io.ReadAll(io.LimitReader(body, 8*1024*1024))
	if err != nil {
		return TokenUsage{}, err
	}
	var frame struct {
		Choices []struct {
			Message struct {
				Content string `json:"content"`
			} `json:"message"`
			Text string `json:"text"`
		} `json:"choices"`
		Usage *struct {
			PromptTokens     int `json:"prompt_tokens"`
			CompletionTokens int `json:"completion_tokens"`
			TotalTokens      int `json:"total_tokens"`
		} `json:"usage"`
	}
	if err := json.Unmarshal(payload, &frame); err != nil {
		return TokenUsage{}, fmt.Errorf("模型供应商没有返回可解析的流式或 JSON 对话结果: %s", providerErrorPreview(payload))
	}
	usage := TokenUsage{}
	if frame.Usage != nil {
		usage = TokenUsage{PromptTokens: frame.Usage.PromptTokens, CompletionTokens: frame.Usage.CompletionTokens, TotalTokens: frame.Usage.TotalTokens}
	}
	for _, choice := range frame.Choices {
		content := choice.Message.Content
		if content == "" {
			content = choice.Text
		}
		if strings.TrimSpace(content) == "" {
			continue
		}
		if err := emitChunked(content, onDelta); err != nil {
			return usage, err
		}
	}
	return usage, nil
}

func emitChunked(value string, onDelta func(delta string) error) error {
	for _, chunk := range splitChunks(value, 48) {
		if chunk == "" {
			continue
		}
		if err := onDelta(chunk); err != nil {
			return err
		}
	}
	return nil
}

func deterministicFallback(messages []Message) string {
	last := "你的问题"
	for i := len(messages) - 1; i >= 0; i-- {
		if messages[i].Role == "user" && strings.TrimSpace(messages[i].Content) != "" {
			last = messages[i].Content
			break
		}
	}
	return "我会先把问题收束为一个可执行判断：" + last + "。先看目标、约束和最小验证，再决定下一步。"
}

func splitChunks(value string, size int) []string {
	runes := []rune(value)
	if size <= 0 || len(runes) <= size {
		return []string{value}
	}
	chunks := make([]string, 0, (len(runes)+size-1)/size)
	for start := 0; start < len(runes); start += size {
		end := start + size
		if end > len(runes) {
			end = len(runes)
		}
		chunks = append(chunks, string(runes[start:end]))
	}
	return chunks
}
