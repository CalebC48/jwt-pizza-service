const config = require("./config");
const os = require("os");

class MetricBuilder {
  constructor() {
    this.metrics = [];
  }

  addMetric(name, value, labels = {}) {
    labels.source = config.metrics.source;

    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}=${v}`)
      .join(",");

    this.metrics.push(`${name}{${labelStr}} ${value}`);
  }

  toString(separator = "\n") {
    return this.metrics.join(separator);
  }
}

function getCpuUsagePercentage() {
  const cpuUsage = os.loadavg()[0] / os.cpus().length;
  return cpuUsage.toFixed(2) * 100;
}

function getMemoryUsagePercentage() {
  const totalMemory = os.totalmem();
  const freeMemory = os.freemem();
  const usedMemory = totalMemory - freeMemory;
  const memoryUsage = (usedMemory / totalMemory) * 100;
  return memoryUsage.toFixed(2);
}

function sendMetricsPeriodically(period) {
  const timer = setInterval(() => {
    try {
      const buf = new MetricBuilder();
      httpMetrics(buf);
      systemMetrics(buf);
      userMetrics(buf);
      purchaseMetrics(buf);
      authMetrics(buf);

      const metrics = buf.toString("\n");
      sendMetricToGrafana(metrics);
    } catch (error) {
      console.log("Error sending metrics", error);
    }
  }, period);
}

// let requests = 0;
let latency = 0;
const requests = {};

function track(endpoint) {
  return (req, res, next) => {
    requests[endpoint] = (requests[endpoint] || 0) + 1;
    next();
  };
}

function sendMetricToGrafana(metricName, metricValue, attributes) {
  attributes = { ...attributes, source: config.source };

  const metric = {
    resourceMetrics: [
      {
        scopeMetrics: [
          {
            metrics: [
              {
                name: metricName,
                unit: "1",
                sum: {
                  dataPoints: [
                    {
                      asInt: metricValue,
                      timeUnixNano: Date.now() * 1000000,
                      attributes: [],
                    },
                  ],
                  aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
                  isMonotonic: true,
                },
              },
            ],
          },
        ],
      },
    ],
  };

  Object.keys(attributes).forEach((key) => {
    metric.resourceMetrics[0].scopeMetrics[0].metrics[0].sum.dataPoints[0].attributes.push(
      {
        key: key,
        value: { stringValue: attributes[key] },
      }
    );
  });

  fetch(`${config.url}`, {
    method: "POST",
    body: JSON.stringify(metric),
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
  })
    .then((response) => {
      if (!response.ok) {
        console.error("Failed to push metrics data to Grafana");
      } else {
        console.log(`Pushed ${metricName}`);
      }
    })
    .catch((error) => {
      console.error("Error pushing metrics:", error);
    });
}

module.exports = { track };

function httpMetrics(builder) {
  const metric = {
    name: "http_requests",
    unit: "1",
    sum: {
      dataPoints: [
        {
          asInt: totalRequests,
          timeUnixNano: Date.now() * 1000000,
          attributes: [{ key: "method", value: { stringValue: "total" } }],
        },
        {
          asInt: getRequests,
          timeUnixNano: Date.now() * 1000000,
          attributes: [{ key: "method", value: { stringValue: "get" } }],
        },
        // Add POST, PUT, DELETE methods similarly
      ],
      aggregationTemporality: "AGGREGATION_TEMPORALITY_CUMULATIVE",
      isMonotonic: true,
    },
  };

  return metric;
}

function systemMetrics(builder) {
  return [
    {
      name: "system_cpu_usage",
      unit: "%",
      gauge: {
        dataPoints: [
          {
            asDouble: getCpuUsagePercentage(),
            timeUnixNano: Date.now() * 1000000,
          },
        ],
      },
    },
    {
      name: "system_memory_usage",
      unit: "%",
      gauge: {
        dataPoints: [
          {
            asDouble: getMemoryUsagePercentage(),
            timeUnixNano: Date.now() * 1000000,
          },
        ],
      },
    },
  ];
}
