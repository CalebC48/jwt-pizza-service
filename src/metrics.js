const config = require("./config");
const os = require("os");
const fetch = require("node-fetch");

class MetricBuilder {
  constructor() {
    this.dataPoints = [];
  }

  addMetric(name, value, labels = {}) {
    const attributes = Object.entries({
      ...labels,
      source: config.metrics.source,
    }).map(([key, value]) => ({
      key,
      value: { stringValue: value.toString() },
    }));

    this.dataPoints.push({
      name,
      value,
      attributes,
    });

    return this;
  }

  getOTLPPayload() {
    return {
      resourceMetrics: [
        {
          scopeMetrics: [
            {
              metrics: this.dataPoints.map((point) => ({
                name: point.name,
                unit: "1",
                sum: {
                  dataPoints: [
                    {
                      asDouble: point.value,
                      timeUnixNano: Date.now() * 1000000,
                      attributes: point.attributes,
                    },
                  ],
                  aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
                  isMonotonic: true,
                },
              })),
            },
          ],
        },
      ],
    };
  }
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return parseFloat((cpuUsage * 100).toFixed(2));
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return parseFloat(memoryUsage.toFixed(2));
}

function systemMetrics(builder) {
  const cpuUsage = getCpuUsagePercentage();
  const memoryUsage = getMemoryUsagePercentage();

  builder.addMetric("system_cpu_usage_percent", cpuUsage);
  builder.addMetric("system_memory_usage_percent", memoryUsage);

  return builder;
}

const requests = {};

const httpRequests = {
  total: 0,
  get: 0,
  post: 0,
  put: 0,
  delete: 0,
  lastResetTime: Date.now(),
};

function track(endpoint) {
  return (req, res, next) => {
    httpRequests.total++;

    const method = req.method.toLowerCase();
    if (httpRequests[method] !== undefined) {
      httpRequests[method]++;
    }

    requests[endpoint] = (requests[endpoint] || 0) + 1;

    const startTime = Date.now();

    res.on("finish", () => {
      const duration = Date.now() - startTime;
      latencies[endpoint] = duration;
    });

    next();
  };
}

function httpMetrics(builder) {
  const now = Date.now();
  const minutesSinceReset = (now - httpRequests.lastResetTime) / 60000;
  const requestsPerMinute =
    minutesSinceReset > 0
      ? Math.round(httpRequests.total / minutesSinceReset)
      : 0;

  builder.addMetric("http_requests_total", httpRequests.total);
  builder.addMetric("http_requests_per_minute", requestsPerMinute);
  builder.addMetric("http_requests_get", httpRequests.get);
  builder.addMetric("http_requests_post", httpRequests.post);
  builder.addMetric("http_requests_put", httpRequests.put);
  builder.addMetric("http_requests_delete", httpRequests.delete);

  Object.entries(requests).forEach(([endpoint, count]) => {
    builder.addMetric("http_requests_endpoint", count, { endpoint });
  });

  return builder;
}

const activeUsers = {
  count: 0,
  sessions: new Map(),
  lastResetTime: Date.now(),
};

function trackUserActivity(userId, sessionId) {
  const now = Date.now();

  if (!activeUsers.sessions.has(sessionId)) {
    activeUsers.count++;
    activeUsers.sessions.set(sessionId, now);
  } else {
    activeUsers.sessions.set(sessionId, now);
  }

  const thirtyMinutesAgo = now - 30 * 60 * 1000;
  for (const [session, lastActivity] of activeUsers.sessions.entries()) {
    if (lastActivity < thirtyMinutesAgo) {
      activeUsers.sessions.delete(session);
      activeUsers.count = Math.max(0, activeUsers.count - 1);
    }
  }
}

function userMetrics(builder) {
  builder.addMetric("active_users", activeUsers.count);

  const now = Date.now();
  const minutesSinceReset = (now - activeUsers.lastResetTime) / 60000;
  const usersPerMinute =
    minutesSinceReset > 0
      ? Math.round(activeUsers.count / minutesSinceReset)
      : 0;

  builder.addMetric("active_users_per_minute", usersPerMinute);

  return builder;
}

const pizzaMetrics = {
  sold: 0,
  creationFailures: 0,
  revenue: 0,
  lastResetTime: Date.now(),
};

function trackPizzaSale(quantity, price) {
  pizzaMetrics.sold += quantity;
  pizzaMetrics.revenue += price * quantity;
}

function trackPizzaCreationFailure() {
  pizzaMetrics.creationFailures++;
}

function purchaseMetrics(builder) {
  const now = Date.now();
  const minutesSinceReset = (now - pizzaMetrics.lastResetTime) / 60000;

  const soldPerMinute =
    minutesSinceReset > 0
      ? Math.round(pizzaMetrics.sold / minutesSinceReset)
      : 0;

  const revenuePerMinute =
    minutesSinceReset > 0
      ? Math.round(pizzaMetrics.revenue / minutesSinceReset)
      : 0;

  builder.addMetric("pizza_sold_total", pizzaMetrics.sold);
  builder.addMetric("pizza_sold_per_minute", soldPerMinute);
  builder.addMetric("pizza_creation_failures", pizzaMetrics.creationFailures);
  builder.addMetric("pizza_revenue_total", pizzaMetrics.revenue);
  builder.addMetric("pizza_revenue_per_minute", revenuePerMinute);

  return builder;
}

const authAttempts = {
  successful: 0,
  failed: 0,
  lastResetTime: Date.now(),
};

function trackAuthAttempt(success) {
  if (success) {
    authAttempts.successful++;
  } else {
    authAttempts.failed++;
  }
}

function authMetrics(builder) {
  const now = Date.now();
  const minutesSinceReset = (now - authAttempts.lastResetTime) / 60000;

  const successPerMinute =
    minutesSinceReset > 0
      ? Math.round(authAttempts.successful / minutesSinceReset)
      : 0;

  const failedPerMinute =
    minutesSinceReset > 0
      ? Math.round(authAttempts.failed / minutesSinceReset)
      : 0;

  builder.addMetric("auth_attempts_successful", authAttempts.successful);
  builder.addMetric("auth_attempts_successful_per_minute", successPerMinute);
  builder.addMetric("auth_attempts_failed", authAttempts.failed);
  builder.addMetric("auth_attempts_failed_per_minute", failedPerMinute);

  return builder;
}

const latencies = {
  endpoints: {},
  pizzaCreation: 0,
};

function trackPizzaCreationLatency(duration) {
  latencies.pizzaCreation = duration;
}

function latencyMetrics(builder) {
  Object.entries(latencies.endpoints).forEach(([endpoint, latency]) => {
    builder.addMetric("service_latency_ms", latency, { endpoint });
  });

  builder.addMetric("pizza_creation_latency_ms", latencies.pizzaCreation);

  return builder;
}

function sendMetricToGrafana(metrics) {
  const payload = metrics.getOTLPPayload();

  fetch(config.metrics.url, {
    method: "POST",
    body: JSON.stringify(payload),
    headers: {
      Authorization: `Bearer ${config.metrics.apiKey}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        console.error(`Failed to push metrics: ${response.status}`);
      } else {
        console.log("Successfully sent metrics to Grafana");
      }
    })
    .catch((error) => {
      console.error("Error sending metrics:", error.message);
    });
}
function sendMetricsPeriodically(period = 60000) {
  console.log(`Starting metrics collection every ${period / 1000} seconds`);

  const timer = setInterval(() => {
    try {
      const metricBuilder = new MetricBuilder();

      httpMetrics(metricBuilder);
      userMetrics(metricBuilder);
      authMetrics(metricBuilder);
      systemMetrics(metricBuilder);
      purchaseMetrics(metricBuilder);
      latencyMetrics(metricBuilder);

      sendMetricToGrafana(metricBuilder);

      resetCounters();
    } catch (error) {
      console.error("Error collecting metrics:", error);
    }
  }, period);

  return timer;
}

function resetCounters() {
  const now = Date.now();

  httpRequests.total = 0;
  httpRequests.get = 0;
  httpRequests.post = 0;
  httpRequests.put = 0;
  httpRequests.delete = 0;
  httpRequests.lastResetTime = now;

  authAttempts.successful = 0;
  authAttempts.failed = 0;
  authAttempts.lastResetTime = now;

  pizzaMetrics.sold = 0;
  pizzaMetrics.revenue = 0;
  pizzaMetrics.lastResetTime = now;
}

module.exports = {
  track,
  sendMetricsPeriodically,
  trackUserActivity,
  trackAuthAttempt,
  trackPizzaSale,
  trackPizzaCreationFailure,
  trackPizzaCreationLatency,
};
