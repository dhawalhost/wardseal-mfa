package models

import "time"

type PushRequest struct {
	ID        string    `json:"id"`
	UserID    string    `json:"user_id"`
	AppName   string    `json:"app_name"`
	IPAddress string    `json:"ip_address"`
	Location  string    `json:"location"`
	Timestamp time.Time `json:"timestamp"`
	Status    string    `json:"status"` // pending, approved, denied
}

type DeviceRegistration struct {
	DeviceID   string `json:"device_id"`
	DeviceName string `json:"device_name"`
	PushToken  string `json:"push_token"`
	UserID     string `json:"user_id"`
}
