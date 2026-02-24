// Command seed creates a diverse set of Grafana resources for semantic search testing.
//
// Usage:
//
//	go run ./pkg/storage/unified/resource/semantic/testdata/seed.go [--grafana-url http://localhost:3000] [--cleanup]
package main

import (
	"bytes"
	"encoding/json"
	"flag"
	"fmt"
	"io"
	"net/http"
	"strings"
)

var (
	grafanaURL = flag.String("grafana-url", "http://localhost:3000", "Grafana base URL")
	cleanup    = flag.Bool("cleanup", false, "Delete seeded resources instead of creating them")
	user       = flag.String("user", "admin", "Grafana admin username")
	pass       = flag.String("pass", "admin", "Grafana admin password")
)

const uidPrefix = "seed-"

type folder struct {
	UID, Title, Description string
	ParentUID               string
}

type dashboard struct {
	UID, Title, Description string
	FolderUID               string
	Tags                    []string
	Panels                  []panel
}

type panel struct {
	Title, Description string
}

type datasource struct {
	UID, Name, Type, URL string
}

type playlist struct {
	Name     string
	UID      string
	Interval string
}

type alertRule struct {
	UID, Title, FolderUID, RuleGroup string
}

var folders = []folder{
	{UID: uidPrefix + "infra", Title: "Infrastructure Monitoring", Description: "Server and infrastructure health dashboards"},
	{UID: uidPrefix + "k8s", Title: "Kubernetes", Description: "Container orchestration and cluster management"},
	{UID: uidPrefix + "db", Title: "Database Performance", Description: "Database monitoring and query analysis"},
	{UID: uidPrefix + "app", Title: "Application Performance", Description: "Application latency, errors, and throughput"},
	{UID: uidPrefix + "business", Title: "Business Metrics", Description: "Revenue, users, and product analytics"},
	{UID: uidPrefix + "network", Title: "Network Operations", Description: "Network traffic, DNS, and connectivity monitoring"},
	{UID: uidPrefix + "security", Title: "Security & Compliance", Description: "Security events, audit logs, and compliance"},
	{UID: uidPrefix + "ci", Title: "CI/CD Pipelines", Description: "Build and deployment pipeline observability"},
}

var dashboards = []dashboard{
	// Infrastructure
	{UID: uidPrefix + "cpu", Title: "CPU Usage Overview", Description: "Real-time CPU utilization across all hosts broken down by core, user, system, and iowait", FolderUID: uidPrefix + "infra", Tags: []string{"infrastructure", "cpu", "hardware"},
		Panels: []panel{{Title: "CPU Load Average (1m, 5m, 15m)", Description: "System load average over time"}, {Title: "Per-Core Utilization Heatmap", Description: "Heatmap showing utilization per CPU core"}}},
	{UID: uidPrefix + "mem", Title: "Memory and Swap Utilization", Description: "Physical memory usage, swap activity, and OOM killer events per host", FolderUID: uidPrefix + "infra", Tags: []string{"infrastructure", "memory"},
		Panels: []panel{{Title: "Available vs Used Memory", Description: "Memory usage over time"}, {Title: "Swap In/Out Rate", Description: "Swap activity indicating memory pressure"}}},
	{UID: uidPrefix + "disk", Title: "Disk I/O and Storage Capacity", Description: "Disk read/write throughput, IOPS, latency, and filesystem usage percentages", FolderUID: uidPrefix + "infra", Tags: []string{"infrastructure", "disk", "storage"},
		Panels: []panel{{Title: "Disk IOPS by Device", Description: "Read and write operations per second"}, {Title: "Filesystem Usage %", Description: "Percentage of disk space used per mount"}}},
	{UID: uidPrefix + "host-overview", Title: "Host Overview", Description: "Single-pane-of-glass view showing CPU, memory, disk, and network for individual servers", FolderUID: uidPrefix + "infra", Tags: []string{"infrastructure", "overview"},
		Panels: []panel{{Title: "System Uptime", Description: "How long each host has been running"}, {Title: "Top Processes by CPU", Description: "Most resource-intensive processes"}}},

	// Kubernetes
	{UID: uidPrefix + "k8s-pods", Title: "Kubernetes Pod Health", Description: "Pod status, restart counts, readiness probes, and container resource requests vs limits", FolderUID: uidPrefix + "k8s", Tags: []string{"kubernetes", "pods", "containers"},
		Panels: []panel{{Title: "Pod Phase Distribution", Description: "Running, pending, failed, succeeded pods"}, {Title: "Container Restart Count", Description: "Containers that have restarted recently"}}},
	{UID: uidPrefix + "k8s-nodes", Title: "Kubernetes Node Resources", Description: "Node-level CPU, memory, and pod capacity with allocatable vs requested resources", FolderUID: uidPrefix + "k8s", Tags: []string{"kubernetes", "nodes"},
		Panels: []panel{{Title: "Node CPU Allocatable vs Requested", Description: "Resource allocation efficiency"}, {Title: "Node Conditions", Description: "DiskPressure, MemoryPressure, PIDPressure status"}}},
	{UID: uidPrefix + "k8s-deploy", Title: "Deployment Rollout Status", Description: "Deployment replica counts, rollout progress, and rolling update strategy metrics", FolderUID: uidPrefix + "k8s", Tags: []string{"kubernetes", "deployments"},
		Panels: []panel{{Title: "Desired vs Available Replicas", Description: "Rollout convergence tracking"}, {Title: "Deployment Age", Description: "Time since last deployment update"}}},

	// Database
	{UID: uidPrefix + "pg", Title: "PostgreSQL Performance", Description: "PostgreSQL query throughput, connection pool utilization, lock waits, and replication lag", FolderUID: uidPrefix + "db", Tags: []string{"database", "postgresql"},
		Panels: []panel{{Title: "Active Connections", Description: "Current database connections by state"}, {Title: "Slow Queries (>1s)", Description: "Queries exceeding 1 second execution time"}}},
	{UID: uidPrefix + "mysql", Title: "MySQL Query Analysis", Description: "MySQL query execution statistics, InnoDB buffer pool hit ratio, and thread activity", FolderUID: uidPrefix + "db", Tags: []string{"database", "mysql"},
		Panels: []panel{{Title: "QPS by Statement Type", Description: "Queries per second for SELECT, INSERT, UPDATE, DELETE"}, {Title: "Buffer Pool Hit Ratio", Description: "InnoDB buffer pool cache effectiveness"}}},
	{UID: uidPrefix + "redis", Title: "Redis Cache Monitoring", Description: "Redis hit rate, memory usage, evictions, connected clients, and keyspace statistics", FolderUID: uidPrefix + "db", Tags: []string{"database", "redis", "cache"},
		Panels: []panel{{Title: "Cache Hit Rate", Description: "Percentage of successful cache lookups"}, {Title: "Memory Fragmentation Ratio", Description: "Memory allocation efficiency"}}},

	// Application
	{UID: uidPrefix + "http", Title: "HTTP Request Latency and Errors", Description: "Request duration percentiles (p50, p95, p99), error rates by status code, and throughput per endpoint", FolderUID: uidPrefix + "app", Tags: []string{"application", "http", "latency"},
		Panels: []panel{{Title: "Request Duration Percentiles", Description: "p50, p95, p99 latency breakdown"}, {Title: "Error Rate by Status Code", Description: "4xx and 5xx responses over time"}}},
	{UID: uidPrefix + "traces", Title: "Distributed Tracing Overview", Description: "Service dependency map, trace duration distribution, and span error analysis using Jaeger or Tempo", FolderUID: uidPrefix + "app", Tags: []string{"application", "tracing", "observability"},
		Panels: []panel{{Title: "Service Dependency Graph", Description: "Visual map of service-to-service calls"}, {Title: "Trace Duration Histogram", Description: "Distribution of end-to-end trace durations"}}},
	{UID: uidPrefix + "logs", Title: "Application Log Analysis", Description: "Log volume trends, error log patterns, and log-based alerting using Loki", FolderUID: uidPrefix + "app", Tags: []string{"application", "logs", "loki"},
		Panels: []panel{{Title: "Log Volume by Level", Description: "INFO, WARN, ERROR log counts"}, {Title: "Top Error Messages", Description: "Most frequent error log patterns"}}},
	{UID: uidPrefix + "grpc", Title: "gRPC Service Metrics", Description: "gRPC unary and streaming call rates, error codes, and per-method latency breakdown", FolderUID: uidPrefix + "app", Tags: []string{"application", "grpc"},
		Panels: []panel{{Title: "gRPC Call Rate by Method", Description: "Requests per second per RPC method"}, {Title: "gRPC Error Codes", Description: "Distribution of error codes (OK, Unavailable, DeadlineExceeded)"}}},

	// Business
	{UID: uidPrefix + "revenue", Title: "Revenue and Billing Dashboard", Description: "Daily and monthly recurring revenue, ARPU, churn rate, and billing failure analysis", FolderUID: uidPrefix + "business", Tags: []string{"business", "revenue", "finance"},
		Panels: []panel{{Title: "Monthly Recurring Revenue (MRR)", Description: "Total MRR trend"}, {Title: "Churn Rate", Description: "Customer and revenue churn percentages"}}},
	{UID: uidPrefix + "signups", Title: "User Signups and Activation", Description: "New user registration funnel, activation milestones, and onboarding completion rates", FolderUID: uidPrefix + "business", Tags: []string{"business", "users", "growth"},
		Panels: []panel{{Title: "Daily New Signups", Description: "Registration count per day"}, {Title: "Activation Funnel", Description: "Steps from signup to first meaningful action"}}},
	{UID: uidPrefix + "conversion", Title: "Conversion Funnel Analytics", Description: "Product conversion rates from free trial to paid, upgrade paths, and feature adoption", FolderUID: uidPrefix + "business", Tags: []string{"business", "conversion", "product"},
		Panels: []panel{{Title: "Trial to Paid Conversion", Description: "Percentage of trials converting to paid plans"}, {Title: "Feature Adoption Heatmap", Description: "Which features are used most after signup"}}},

	// Network
	{UID: uidPrefix + "nettraffic", Title: "Network Traffic Analysis", Description: "Inbound and outbound bandwidth utilization, packet loss, and top talkers by IP", FolderUID: uidPrefix + "network", Tags: []string{"network", "bandwidth", "traffic"},
		Panels: []panel{{Title: "Bandwidth Utilization (Inbound/Outbound)", Description: "Network throughput by interface"}, {Title: "Packet Loss Rate", Description: "Percentage of dropped packets"}}},
	{UID: uidPrefix + "dns", Title: "DNS Resolution Monitoring", Description: "DNS query latency, failure rates, NXDOMAIN responses, and resolver cache hit ratio", FolderUID: uidPrefix + "network", Tags: []string{"network", "dns"},
		Panels: []panel{{Title: "DNS Query Latency", Description: "Time to resolve DNS queries"}, {Title: "NXDOMAIN Rate", Description: "Failed DNS lookups over time"}}},

	// Security
	{UID: uidPrefix + "audit", Title: "Audit Log Explorer", Description: "User login events, permission changes, API access patterns, and suspicious activity detection", FolderUID: uidPrefix + "security", Tags: []string{"security", "audit", "compliance"},
		Panels: []panel{{Title: "Login Events Timeline", Description: "Successful and failed login attempts"}, {Title: "Permission Changes", Description: "Role and access modifications"}}},
	{UID: uidPrefix + "vuln", Title: "Vulnerability Scanning Results", Description: "Container image CVE counts, severity distribution, and remediation tracking", FolderUID: uidPrefix + "security", Tags: []string{"security", "vulnerabilities", "cve"},
		Panels: []panel{{Title: "CVE Count by Severity", Description: "Critical, high, medium, low vulnerabilities"}, {Title: "Images Needing Update", Description: "Container images with unpatched vulnerabilities"}}},

	// CI/CD
	{UID: uidPrefix + "builds", Title: "Build Pipeline Performance", Description: "Build success rate, duration trends, flaky test detection, and queue wait times", FolderUID: uidPrefix + "ci", Tags: []string{"cicd", "builds", "pipeline"},
		Panels: []panel{{Title: "Build Success Rate", Description: "Percentage of builds passing"}, {Title: "Build Duration Trend", Description: "Average build time over last 30 days"}}},
	{UID: uidPrefix + "deploys", Title: "Deployment Frequency and Lead Time", Description: "DORA metrics including deployment frequency, lead time for changes, and change failure rate", FolderUID: uidPrefix + "ci", Tags: []string{"cicd", "deployments", "dora"},
		Panels: []panel{{Title: "Deployment Frequency", Description: "How often code is deployed to production"}, {Title: "Change Failure Rate", Description: "Percentage of deployments causing incidents"}}},
}

var datasources = []datasource{
	{UID: uidPrefix + "ds-prom", Name: "Production Prometheus", Type: "prometheus", URL: "http://prometheus:9090"},
	{UID: uidPrefix + "ds-loki", Name: "Loki Log Aggregator", Type: "loki", URL: "http://loki:3100"},
	{UID: uidPrefix + "ds-tempo", Name: "Tempo Distributed Tracing", Type: "tempo", URL: "http://tempo:3200"},
	{UID: uidPrefix + "ds-pg", Name: "PostgreSQL Analytics", Type: "postgres", URL: "localhost:5432"},
	{UID: uidPrefix + "ds-mysql", Name: "MySQL Application Database", Type: "mysql", URL: "localhost:3306"},
	{UID: uidPrefix + "ds-influx", Name: "InfluxDB Time Series", Type: "influxdb", URL: "http://influxdb:8086"},
	{UID: uidPrefix + "ds-es", Name: "Elasticsearch Logs", Type: "elasticsearch", URL: "http://elasticsearch:9200"},
	{UID: uidPrefix + "ds-cw", Name: "AWS CloudWatch", Type: "cloudwatch", URL: ""},
}

var playlists = []playlist{
	{UID: uidPrefix + "pl-infra", Name: "Infrastructure Overview Rotation", Interval: "30s"},
	{UID: uidPrefix + "pl-oncall", Name: "On-Call Monitoring Screens", Interval: "1m"},
	{UID: uidPrefix + "pl-exec", Name: "Executive Business Summary", Interval: "2m"},
}

var alertRules = []alertRule{
	{UID: uidPrefix + "alert-cpu", Title: "High CPU usage above 90% for 5 minutes", FolderUID: uidPrefix + "infra", RuleGroup: "infrastructure-alerts"},
	{UID: uidPrefix + "alert-mem", Title: "Memory usage exceeding 85% threshold", FolderUID: uidPrefix + "infra", RuleGroup: "infrastructure-alerts"},
	{UID: uidPrefix + "alert-disk", Title: "Disk space running low below 10% free", FolderUID: uidPrefix + "infra", RuleGroup: "infrastructure-alerts"},
	{UID: uidPrefix + "alert-pod", Title: "Kubernetes pod crash looping detected", FolderUID: uidPrefix + "k8s", RuleGroup: "kubernetes-alerts"},
	{UID: uidPrefix + "alert-5xx", Title: "HTTP 5xx error rate exceeding 1% of traffic", FolderUID: uidPrefix + "app", RuleGroup: "application-alerts"},
	{UID: uidPrefix + "alert-latency", Title: "API response latency p99 above 2 seconds", FolderUID: uidPrefix + "app", RuleGroup: "application-alerts"},
	{UID: uidPrefix + "alert-pg", Title: "PostgreSQL replication lag exceeding 30 seconds", FolderUID: uidPrefix + "db", RuleGroup: "database-alerts"},
	{UID: uidPrefix + "alert-redis", Title: "Redis cache eviction rate spike detected", FolderUID: uidPrefix + "db", RuleGroup: "database-alerts"},
}

func main() {
	flag.Parse()

	if *cleanup {
		doCleanup()
	} else {
		doSeed()
	}
}

func doSeed() {
	fmt.Println("=== Seeding Grafana resources ===")

	fmt.Println("\n--- Folders ---")
	for _, f := range folders {
		body := map[string]any{"uid": f.UID, "title": f.Title, "description": f.Description}
		if f.ParentUID != "" {
			body["parentUid"] = f.ParentUID
		}
		post("/api/folders", body)
	}

	fmt.Println("\n--- Datasources ---")
	for _, ds := range datasources {
		body := map[string]any{"uid": ds.UID, "name": ds.Name, "type": ds.Type, "url": ds.URL, "access": "proxy"}
		post("/api/datasources", body)
	}

	fmt.Println("\n--- Dashboards ---")
	for _, d := range dashboards {
		panels := make([]map[string]any, len(d.Panels))
		for i, p := range d.Panels {
			panels[i] = map[string]any{
				"id":          i + 1,
				"type":        "timeseries",
				"title":       p.Title,
				"description": p.Description,
				"gridPos":     map[string]any{"h": 8, "w": 12, "x": (i % 2) * 12, "y": (i / 2) * 8},
			}
		}
		body := map[string]any{
			"dashboard": map[string]any{
				"uid":         d.UID,
				"title":       d.Title,
				"description": d.Description,
				"tags":        d.Tags,
				"panels":      panels,
			},
			"folderUid": d.FolderUID,
			"overwrite": true,
		}
		post("/api/dashboards/db", body)
	}

	fmt.Println("\n--- Playlists ---")
	for _, p := range playlists {
		body := map[string]any{
			"uid":      p.UID,
			"name":     p.Name,
			"interval": p.Interval,
			"items":    []map[string]any{},
		}
		post("/api/playlists", body)
	}

	fmt.Println("\n--- Alert Rules ---")
	for _, a := range alertRules {
		body := map[string]any{
			"uid":          a.UID,
			"title":        a.Title,
			"folderUID":    a.FolderUID,
			"ruleGroup":    a.RuleGroup,
			"condition":    "A",
			"noDataState":  "NoData",
			"execErrState": "Alerting",
			"for":          "5m",
			"data": []map[string]any{
				{
					"refId":         "A",
					"datasourceUid": "__expr__",
					"model": map[string]any{
						"expression": "1 == 1",
						"type":       "math",
					},
				},
			},
		}
		post("/api/v1/provisioning/alert-rules", body)
	}

	fmt.Printf("\n=== Done! Created %d folders, %d dashboards, %d datasources, %d playlists, %d alert rules ===\n",
		len(folders), len(dashboards), len(datasources), len(playlists), len(alertRules))
}

func doCleanup() {
	fmt.Println("=== Cleaning up seeded resources ===")

	fmt.Println("\n--- Alert Rules ---")
	for _, a := range alertRules {
		del("/api/v1/provisioning/alert-rules/" + a.UID)
	}

	fmt.Println("\n--- Playlists ---")
	for _, p := range playlists {
		del("/api/playlists/" + p.UID)
	}

	fmt.Println("\n--- Dashboards ---")
	for _, d := range dashboards {
		del("/api/dashboards/uid/" + d.UID)
	}

	fmt.Println("\n--- Datasources ---")
	for _, ds := range datasources {
		del("/api/datasources/uid/" + ds.UID)
	}

	fmt.Println("\n--- Folders ---")
	for _, f := range folders {
		del("/api/folders/" + f.UID)
	}

	fmt.Println("\n=== Cleanup complete ===")
}

func post(path string, body any) {
	data, _ := json.Marshal(body)
	req, _ := http.NewRequest("POST", *grafanaURL+path, bytes.NewReader(data))
	req.Header.Set("Content-Type", "application/json")
	req.SetBasicAuth(*user, *pass)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("  ERROR %s: %v\n", path, err)
		return
	}
	defer resp.Body.Close()
	respBody, _ := io.ReadAll(resp.Body)

	status := "OK"
	if resp.StatusCode >= 400 {
		status = fmt.Sprintf("FAIL: %s", string(respBody))
	}

	// Extract a name/title from the body for logging.
	name := path
	if m, ok := body.(map[string]any); ok {
		for _, key := range []string{"title", "name"} {
			if v, ok := m[key].(string); ok {
				name = v
				break
			}
		}
		if d, ok := m["dashboard"].(map[string]any); ok {
			if v, ok := d["title"].(string); ok {
				name = v
			}
		}
	}
	fmt.Printf("  %-50s [%d] %s\n", name, resp.StatusCode, status)
}

func del(path string) {
	req, _ := http.NewRequest("DELETE", *grafanaURL+path, nil)
	req.SetBasicAuth(*user, *pass)

	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		fmt.Printf("  ERROR %s: %v\n", path, err)
		return
	}
	defer resp.Body.Close()
	io.ReadAll(resp.Body)

	parts := strings.Split(path, "/")
	uid := parts[len(parts)-1]
	fmt.Printf("  %-50s [%d]\n", uid, resp.StatusCode)
}
