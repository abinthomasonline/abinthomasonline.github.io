(function () {
  "use strict";

  var STATUS_ENDPOINT = "https://homelab.abinthomas.in/v1/status";
  var EXPECTED_NODE_IDS = ["hs-hp", "hs-mac"];
  var VALID_STATES = ["online", "degraded", "offline", "unknown"];
  var ISO_UTC_PATTERN = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;
  var POLL_INTERVAL_MS = 60 * 1000;
  var REQUEST_TIMEOUT_MS = 5 * 1000;
  var MAX_RESPONSE_AGE_MS = 2 * 60 * 1000;
  var MAX_FUTURE_SKEW_MS = 60 * 1000;

  var root = document.querySelector("[data-node-status-root]");
  if (!root) {
    return;
  }

  var message = root.querySelector("[data-node-status-message]");
  var updated = root.querySelector("[data-node-status-updated]");
  var nodeElements = {};
  var pollTimer = null;
  var activeRequest = null;
  var lastAnnouncement = "";
  var pageIsActive = true;

  EXPECTED_NODE_IDS.forEach(function (nodeId) {
    nodeElements[nodeId] = root.querySelector('[data-node-id="' + nodeId + '"]');
  });

  function hasExactKeys(value, expectedKeys) {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return false;
    }

    return Object.keys(value).sort().join("|") === expectedKeys.slice().sort().join("|");
  }

  function parseStatus(payload) {
    if (!hasExactKeys(payload, ["schemaVersion", "generatedAt", "nodes"])) {
      throw new Error("Invalid status response");
    }
    if (payload.schemaVersion !== 1 || !Array.isArray(payload.nodes) || payload.nodes.length !== EXPECTED_NODE_IDS.length) {
      throw new Error("Unsupported status response");
    }

    if (typeof payload.generatedAt !== "string" || !ISO_UTC_PATTERN.test(payload.generatedAt)) {
      throw new Error("Invalid status timestamp");
    }

    var generatedAt = Date.parse(payload.generatedAt);
    var now = Date.now();
    if (!Number.isFinite(generatedAt) || now - generatedAt > MAX_RESPONSE_AGE_MS || generatedAt - now > MAX_FUTURE_SKEW_MS) {
      throw new Error("Stale status response");
    }

    var nodes = payload.nodes.map(function (node, index) {
      if (!hasExactKeys(node, ["id", "state"])) {
        throw new Error("Invalid node status");
      }
      if (node.id !== EXPECTED_NODE_IDS[index] || VALID_STATES.indexOf(node.state) === -1) {
        throw new Error("Unexpected node status");
      }
      return { id: node.id, state: node.state };
    });

    return { generatedAt: new Date(generatedAt), nodes: nodes };
  }

  function updateNode(nodeId, state, label) {
    var element = nodeElements[nodeId];
    if (!element) {
      return;
    }

    element.dataset.state = state;
    var stateElement = element.querySelector("[data-node-state]");
    if (stateElement) {
      stateElement.textContent = label;
    }
  }

  function announce(text) {
    if (message && text !== lastAnnouncement) {
      message.textContent = text;
      lastAnnouncement = text;
    }
  }

  function showUnavailable() {
    EXPECTED_NODE_IDS.forEach(function (nodeId) {
      updateNode(nodeId, "unknown", "unavailable");
    });
    if (updated) {
      updated.hidden = true;
      updated.removeAttribute("datetime");
      updated.textContent = "";
    }
    announce("Node status is temporarily unavailable.");
  }

  function showChecking() {
    EXPECTED_NODE_IDS.forEach(function (nodeId) {
      updateNode(nodeId, "unknown", "checking");
    });
    if (updated) {
      updated.hidden = true;
      updated.removeAttribute("datetime");
      updated.textContent = "";
    }
    announce("Checking node status…");
  }

  function showStatus(status) {
    status.nodes.forEach(function (node) {
      updateNode(node.id, node.state, node.state);
    });

    var summary = status.nodes.map(function (node) {
      return node.id + " " + node.state;
    }).join(", ");
    announce(summary + ".");

    var updatedTime = new Intl.DateTimeFormat([], {
      hour: "numeric",
      minute: "2-digit"
    }).format(status.generatedAt);
    if (updated) {
      updated.dateTime = status.generatedAt.toISOString();
      updated.textContent = "Updated " + updatedTime + ".";
      updated.hidden = false;
    }
  }

  function scheduleNextPoll() {
    window.clearTimeout(pollTimer);
    pollTimer = null;
    if (pageIsActive && !document.hidden) {
      pollTimer = window.setTimeout(fetchStatus, POLL_INTERVAL_MS);
    }
  }

  async function fetchStatus() {
    if (!pageIsActive || document.hidden || activeRequest) {
      scheduleNextPoll();
      return;
    }

    var controller = new AbortController();
    var timeout = window.setTimeout(function () {
      controller.abort();
    }, REQUEST_TIMEOUT_MS);
    activeRequest = controller;

    try {
      var response = await fetch(STATUS_ENDPOINT, {
        method: "GET",
        headers: { "Accept": "application/json" },
        cache: "no-store",
        credentials: "omit",
        signal: controller.signal
      });
      if (!response.ok) {
        throw new Error("Status request failed");
      }
      showStatus(parseStatus(await response.json()));
    } catch (error) {
      if (pageIsActive && activeRequest === controller) {
        showUnavailable();
      }
    } finally {
      window.clearTimeout(timeout);
      if (activeRequest === controller) {
        activeRequest = null;
        scheduleNextPoll();
      }
    }
  }

  document.addEventListener("visibilitychange", function () {
    window.clearTimeout(pollTimer);
    pollTimer = null;
    if (!document.hidden) {
      showChecking();
      fetchStatus();
    }
  });

  window.addEventListener("pagehide", function () {
    pageIsActive = false;
    window.clearTimeout(pollTimer);
    pollTimer = null;
    if (activeRequest) {
      var request = activeRequest;
      activeRequest = null;
      request.abort();
    }
  });

  window.addEventListener("pageshow", function () {
    pageIsActive = true;
    window.clearTimeout(pollTimer);
    pollTimer = null;
    if (!document.hidden) {
      showChecking();
      fetchStatus();
    }
  });

  fetchStatus();
}());
