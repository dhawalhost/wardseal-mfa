package api

import (
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/dhawalhost/wardseal-mfa/internal/models"
	"github.com/dhawalhost/wardseal-mfa/internal/push"
	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
)

type Handler struct {
	pushMgr *push.Manager
}

func NewHandler(mgr *push.Manager) *Handler {
	return &Handler{pushMgr: mgr}
}

func (h *Handler) RegisterDevice(c *gin.Context) {
	var reg models.DeviceRegistration
	if err := c.BindJSON(&reg); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	h.pushMgr.RegisterDevice(&reg)
	c.JSON(http.StatusOK, gin.H{"message": "Device registered successfully"})
}

func (h *Handler) SendPush(c *gin.Context) {
	var req models.PushRequest
	if err := c.BindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	req.ID = uuid.New().String()
	req.Timestamp = time.Now()
	req.Status = "pending"

	if h.pushMgr.SendPush(&req) {
		c.JSON(http.StatusOK, gin.H{"id": req.ID, "status": "sent"})
	} else {
		c.JSON(http.StatusNotFound, gin.H{"error": "no device subscribed for user"})
	}
}

func (h *Handler) HandleDecision(c *gin.Context) {
	type Decision struct {
		RequestID string `json:"request_id"`
		Approved  bool   `json:"approved"`
	}
	var dec Decision
	if err := c.BindJSON(&dec); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request"})
		return
	}
	h.pushMgr.HandleDecision(dec.RequestID, dec.Approved)
	c.JSON(http.StatusOK, gin.H{"message": "Decision recorded"})
}

func (h *Handler) GetLatestRequest(c *gin.Context) {
	userID := c.Query("user_id")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "user_id required"})
		return
	}

	// Find the latest pending request for this user
	req := h.pushMgr.GetLatestPending(userID)
	if req != nil {
		c.JSON(http.StatusOK, req)
	} else {
		c.JSON(http.StatusNoContent, nil)
	}
}

func (h *Handler) GetRequestStatus(c *gin.Context) {
	id := c.Param("id")
	if req, ok := h.pushMgr.GetRequest(id); ok {
		c.JSON(http.StatusOK, req)
	} else {
		c.JSON(http.StatusNotFound, gin.H{"error": "request not found"})
	}
}

func (h *Handler) PushEvents(c *gin.Context) {
	userID := c.Query("user_id")
	if userID == "" {
		c.String(http.StatusBadRequest, "user_id required")
		return
	}

	ch := h.pushMgr.Subscribe(userID)
	defer h.pushMgr.Unsubscribe(userID)

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("Transfer-Encoding", "chunked")

	c.Stream(func(w io.Writer) bool {
		if req, ok := <-ch; ok {
			data, _ := json.Marshal(req)
			fmt.Fprintf(w, "data: %s\n\n", data)
			return true
		}
		return false
	})
}
