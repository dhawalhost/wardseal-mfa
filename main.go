package main

import (
	"log"

	"github.com/dhawalhost/wardseal-mfa/internal/api"
	"github.com/dhawalhost/wardseal-mfa/internal/push"
	"github.com/gin-contrib/cors"
	"github.com/gin-gonic/gin"
)

func main() {
	r := gin.Default()

	// CORS for frontend
	config := cors.DefaultConfig()
	config.AllowAllOrigins = true
	r.Use(cors.New(config))

	pushMgr := push.NewManager()
	h := api.NewHandler(pushMgr)

	r.POST("/register", h.RegisterDevice)
	r.POST("/send", h.SendPush)
	r.POST("/decision", h.HandleDecision)
	r.GET("/status/latest", h.GetLatestRequest)
	r.GET("/status/:id", h.GetRequestStatus)
	r.GET("/events", h.PushEvents)

	log.Println("WardSeal MFA Service starting on :8090")
	if err := r.Run(":8090"); err != nil {
		log.Fatal(err)
	}
}
