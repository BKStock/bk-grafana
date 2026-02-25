package notifier

import (
	"context"
	"encoding/json"
	"fmt"

	alertingNotify "github.com/grafana/alerting/notify"

	apimodels "github.com/grafana/grafana/pkg/services/ngalert/api/tooling/definitions"
)

// TODO: We no longer do apimodels at this layer, move it to the API.
func (am *alertmanager) GetStatus(_ context.Context) (apimodels.GettableStatus, error) {
	status := am.Base.GetStatus() // TODO: This should return a GettableStatus, for now it returns PostableApiAlertingConfig.
	if status == nil {
		return *apimodels.NewGettableStatus(&apimodels.PostableApiAlertingConfig{}), nil
	}

	config := alertingNotify.NotificationsConfiguration{}
	if err := json.Unmarshal(status, &config); err != nil {
		return apimodels.GettableStatus{}, fmt.Errorf("unable to unmarshal alertmanager config: %w", err)
	}

	return *apimodels.NewGettableStatus(new(NotificationsConfigurationToPostableAPIConfig(config))), nil
}
