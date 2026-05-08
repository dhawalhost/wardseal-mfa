package push

import (
	"sync"

	"github.com/dhawalhost/wardseal-mfa/internal/models"
)

type Manager struct {
	mu          sync.RWMutex
	devices     map[string]*models.DeviceRegistration
	pending     map[string]*models.PushRequest
	subscribers map[string]chan *models.PushRequest // UserID -> Channel for SSE
}

func NewManager() *Manager {
	return &Manager{
		devices:     make(map[string]*models.DeviceRegistration),
		pending:     make(map[string]*models.PushRequest),
		subscribers: make(map[string]chan *models.PushRequest),
	}
}

func (m *Manager) RegisterDevice(reg *models.DeviceRegistration) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.devices[reg.UserID] = reg
}

func (m *Manager) SendPush(req *models.PushRequest) bool {
	m.mu.Lock()
	defer m.mu.Unlock()

	m.pending[req.ID] = req

	if ch, ok := m.subscribers[req.UserID]; ok {
		ch <- req
		return true
	}
	return false
}

func (m *Manager) Subscribe(userID string) chan *models.PushRequest {
	m.mu.Lock()
	defer m.mu.Unlock()

	ch := make(chan *models.PushRequest, 10)
	m.subscribers[userID] = ch
	return ch
}

func (m *Manager) Unsubscribe(userID string) {
	m.mu.Lock()
	defer m.mu.Unlock()
	delete(m.subscribers, userID)
}

func (m *Manager) HandleDecision(requestID string, approved bool) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if req, ok := m.pending[requestID]; ok {
		if approved {
			req.Status = "approved"
		} else {
			req.Status = "denied"
		}
		// In a real app, this would trigger a callback to WardSeal
	}
}

func (m *Manager) GetLatestPending(userID string) *models.PushRequest {
	m.mu.RLock()
	defer m.mu.RUnlock()
	
	var latest *models.PushRequest
	for _, req := range m.pending {
		if req.UserID == userID && req.Status == "pending" {
			if latest == nil || req.Timestamp.After(latest.Timestamp) {
				latest = req
			}
		}
	}
	return latest
}

func (m *Manager) GetRequest(id string) (*models.PushRequest, bool) {
	m.mu.RLock()
	defer m.mu.RUnlock()
	req, ok := m.pending[id]
	return req, ok
}
