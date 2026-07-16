package service

import (
	"context"
	"time"
)

type OutboxMessage struct {
	ID, Recipient, Subject, TextBody, HTMLBody string
	AttemptCount                               int
}
type NotificationOutboxRepository interface {
	ListPendingOutbox(ctx context.Context, limit int) ([]OutboxMessage, error)
	MarkOutboxSent(ctx context.Context, id string) error
	MarkOutboxFailed(ctx context.Context, id, errorMessage string, nextAttempt time.Time) error
}
type NotificationDispatcher struct {
	repo   NotificationOutboxRepository
	sender NotificationEmailSender
}

func NewNotificationDispatcher(repo NotificationOutboxRepository, sender NotificationEmailSender) *NotificationDispatcher {
	return &NotificationDispatcher{repo: repo, sender: sender}
}
func (d *NotificationDispatcher) RunOnce(ctx context.Context) error {
	if d == nil || d.repo == nil || d.sender == nil {
		return nil
	}
	items, err := d.repo.ListPendingOutbox(ctx, 20)
	if err != nil {
		return err
	}
	for _, item := range items {
		if err := d.sender.SendNotification(ctx, item.Recipient, item.Subject, item.TextBody, item.HTMLBody); err != nil {
			delay := time.Duration(1<<min(item.AttemptCount, 6)) * time.Minute
			_ = d.repo.MarkOutboxFailed(ctx, item.ID, err.Error(), time.Now().UTC().Add(delay))
			continue
		}
		_ = d.repo.MarkOutboxSent(ctx, item.ID)
	}
	return nil
}
