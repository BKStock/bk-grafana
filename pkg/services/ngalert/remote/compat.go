package remote

import (
	"github.com/grafana/alerting/definition"
	"github.com/grafana/alerting/models"
	alertingNotify "github.com/grafana/alerting/notify"
)

func APIReceiversToPostableAPIReceivers(r []*alertingNotify.APIReceiver) []*definition.PostableApiReceiver {
	result := make([]*definition.PostableApiReceiver, 0, len(r))
	for _, receiver := range r {
		result = append(result, APIReceiverToPostableAPIReceiver(receiver))
	}
	return result
}

func APIReceiverToPostableAPIReceiver(r *alertingNotify.APIReceiver) *definition.PostableApiReceiver {
	receivers := make([]*definition.PostableGrafanaReceiver, 0, len(r.Integrations))
	for _, p := range r.Integrations {
		receivers = append(receivers, IntegrationConfigToPostableGrafanaReceiver(p))
	}

	return &definition.PostableApiReceiver{
		Receiver: r.ConfigReceiver,
		PostableGrafanaReceivers: definition.PostableGrafanaReceivers{
			GrafanaManagedReceivers: receivers,
		},
	}
}

func IntegrationConfigToPostableGrafanaReceiver(r *models.IntegrationConfig) *definition.PostableGrafanaReceiver {
	return &definition.PostableGrafanaReceiver{
		UID:                   r.UID,
		Name:                  r.Name,
		Type:                  r.Type,
		DisableResolveMessage: r.DisableResolveMessage,
		Settings:              definition.RawMessage(r.Settings),
		SecureSettings:        r.SecureSettings,
	}
}
