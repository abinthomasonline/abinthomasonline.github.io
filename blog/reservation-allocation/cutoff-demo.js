(function () {
  "use strict";

  var SVG_NS = "http://www.w3.org/2000/svg";
  var CANDIDATES = [
    { score: 98, category: "general", outcome: "placed", seat: "open", seatIndex: 0 },
    { score: 95, category: "reservation", outcome: "placed", seat: "open", seatIndex: 1 },
    { score: 92, category: "general", outcome: "placed", seat: "open", seatIndex: 2 },
    { score: 89, category: "reservation", outcome: "placed", seat: "open", seatIndex: 3 },
    { score: 86, category: "general", outcome: "placed", seat: "open", seatIndex: 4 },
    { score: 83, category: "general", outcome: "rejected" },
    { score: 80, category: "reservation", outcome: "placed", seat: "reserved", seatIndex: 0 },
    { score: 77, category: "general", outcome: "rejected" },
    { score: 74, category: "reservation", outcome: "placed", seat: "reserved", seatIndex: 1 },
    { score: 71, category: "reservation", outcome: "placed", seat: "reserved", seatIndex: 2 },
    { score: 68, category: "reservation", outcome: "placed", seat: "reserved", seatIndex: 3 },
    { score: 65, category: "reservation", outcome: "placed", seat: "reserved", seatIndex: 4 }
  ];
  var OPEN_COUNT = 5;
  var RESERVED_COUNT = 5;
  var INTRO_MS = 500;
  var MOVE_MS = 720;
  var BETWEEN_MS = 130;
  var ROW_PAUSE_MS = 650;
  var FINAL_HOLD_MS = 1800;
  var FADE_MS = 300;

  var SEAT_X = [55, 105, 155, 205, 255];
  var OPEN_Y = 72;
  var RESERVED_Y = 173;
  var QUEUE_X = 385;
  var QUEUE_Y = 122;
  var QUEUE_GAP = 50;
  var REJECT_X = 385;
  var REJECT_Y = 173;

  var schedule = [];
  var cursor = INTRO_MS;

  CANDIDATES.forEach(function (_, index) {
    var start = cursor;
    var end = start + MOVE_MS;
    schedule.push({ start: start, end: end });
    cursor = end + BETWEEN_MS;
    if (index === OPEN_COUNT - 1) {
      cursor += ROW_PAUSE_MS;
    }
  });

  var finalCompleteAt = schedule[schedule.length - 1].end;
  var fadeAt = finalCompleteAt + FINAL_HOLD_MS;
  var cycleDuration = fadeAt + FADE_MS;

  function svgElement(name, className) {
    var element = document.createElementNS(SVG_NS, name);
    if (className) {
      element.setAttribute("class", className);
    }
    return element;
  }

  function ease(value) {
    return value < 0.5
      ? 4 * value * value * value
      : 1 - Math.pow(-2 * value + 2, 3) / 2;
  }

  function clamp(value, minimum, maximum) {
    return Math.max(minimum, Math.min(maximum, value));
  }

  function countPlaced(processed, seat) {
    return CANDIDATES.slice(0, processed).filter(function (candidate) {
      return candidate.outcome === "placed" && candidate.seat === seat;
    }).length;
  }

  function lastPlacedScore(processed, seat) {
    var score = null;
    CANDIDATES.slice(0, processed).forEach(function (candidate) {
      if (candidate.outcome === "placed" && candidate.seat === seat) {
        score = candidate.score;
      }
    });
    return score;
  }

  function CutoffDemo(root) {
    this.root = root;
    this.scene = root.querySelector("[data-cutoff-demo-scene]");
    this.openSeats = root.querySelector('[data-cutoff-demo-seats="open"]');
    this.reservedSeats = root.querySelector('[data-cutoff-demo-seats="reserved"]');
    this.candidateLayer = root.querySelector("[data-cutoff-demo-candidates]");
    this.openCutoff = root.querySelector("[data-cutoff-demo-open-cutoff]");
    this.reservedCutoff = root.querySelector("[data-cutoff-demo-reserved-cutoff]");
    this.status = root.querySelector("[data-cutoff-demo-status]");
    this.toggleButtons = Array.prototype.slice.call(
      root.querySelectorAll('[data-cutoff-demo-action="toggle"]')
    );
    this.replayButtons = Array.prototype.slice.call(
      root.querySelectorAll('[data-cutoff-demo-action="replay"]')
    );

    if (!this.scene || !this.openSeats || !this.reservedSeats ||
        !this.candidateLayer || !this.openCutoff || !this.reservedCutoff) {
      root.dataset.cutoffDemoError = "missing-markup";
      return;
    }

    this.elapsed = 0;
    this.lastTimestamp = null;
    this.frame = 0;
    this.userPaused = false;
    this.visibilityPaused = document.hidden;
    this.inView = true;
    this.reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    this.candidates = [];
    this.lastProcessed = -1;

    this.createSeats();
    this.createCandidates();
    this.bindControls();
    this.bindEnvironment();

    if (this.reducedMotion.matches) {
      this.elapsed = finalCompleteAt + 1;
    }

    this.render();
    this.syncPlayback();

    root.cutoffDemo = {
      pause: this.pause.bind(this),
      play: this.play.bind(this),
      restart: this.restart.bind(this),
      toggle: this.toggle.bind(this)
    };
  }

  CutoffDemo.prototype.createSeats = function () {
    var self = this;
    SEAT_X.forEach(function (x) {
      var openSeat = svgElement(
        "circle",
        "cutoff-demo__seat cutoff-demo__seat--open"
      );
      openSeat.setAttribute("cx", x);
      openSeat.setAttribute("cy", OPEN_Y);
      openSeat.setAttribute("r", "22");
      self.openSeats.appendChild(openSeat);

      var reservedSeat = svgElement(
        "circle",
        "cutoff-demo__seat cutoff-demo__seat--reserved"
      );
      reservedSeat.setAttribute("cx", x);
      reservedSeat.setAttribute("cy", RESERVED_Y);
      reservedSeat.setAttribute("r", "22");
      self.reservedSeats.appendChild(reservedSeat);
    });
  };

  CutoffDemo.prototype.createCandidates = function () {
    var self = this;
    CANDIDATES.forEach(function (candidate) {
      var group = svgElement(
        "g",
        "cutoff-demo__candidate cutoff-demo__candidate--" + candidate.category
      );
      var circle = svgElement("circle", "cutoff-demo__candidate-circle");
      var label = svgElement("text", "cutoff-demo__candidate-score");

      circle.setAttribute("r", "22");
      circle.style.fill = candidate.category === "general"
        ? "var(--general)"
        : "var(--obc)";
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("dominant-baseline", "central");
      label.style.fill = candidate.category === "general" ? "#fff" : "#202328";
      label.textContent = candidate.score;
      group.dataset.candidateCategory = candidate.category;
      group.dataset.outcome = candidate.outcome;
      if (candidate.seat) {
        group.dataset.seat = candidate.seat;
      }
      group.setAttribute("aria-hidden", "true");
      group.appendChild(circle);
      group.appendChild(label);

      if (candidate.outcome === "rejected") {
        var firstLine = svgElement("line", "cutoff-demo__reject-mark");
        var secondLine = svgElement("line", "cutoff-demo__reject-mark");
        firstLine.setAttribute("x1", "-12");
        firstLine.setAttribute("y1", "-12");
        firstLine.setAttribute("x2", "12");
        firstLine.setAttribute("y2", "12");
        secondLine.setAttribute("x1", "12");
        secondLine.setAttribute("y1", "-12");
        secondLine.setAttribute("x2", "-12");
        secondLine.setAttribute("y2", "12");
        [firstLine, secondLine].forEach(function (line) {
          line.setAttribute("stroke", "var(--danger)");
          line.setAttribute("stroke-width", "4");
          line.setAttribute("stroke-linecap", "round");
          line.setAttribute("vector-effect", "non-scaling-stroke");
          line.style.opacity = "0";
          group.appendChild(line);
        });
      }

      self.candidateLayer.appendChild(group);
      self.candidates.push(group);
    });
  };

  CutoffDemo.prototype.bindControls = function () {
    var self = this;
    this.toggleButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        self.toggle();
      });
    });
    this.replayButtons.forEach(function (button) {
      button.addEventListener("click", function () {
        self.restart();
      });
    });
  };

  CutoffDemo.prototype.bindEnvironment = function () {
    var self = this;

    document.addEventListener("visibilitychange", function () {
      self.visibilityPaused = document.hidden;
      self.lastTimestamp = null;
      self.syncPlayback();
    });

    var motionChange = function () {
      if (self.reducedMotion.matches) {
        self.elapsed = finalCompleteAt + 1;
        self.userPaused = false;
      } else {
        self.elapsed = 0;
      }
      self.lastTimestamp = null;
      self.render();
      self.syncPlayback();
    };

    if (this.reducedMotion.addEventListener) {
      this.reducedMotion.addEventListener("change", motionChange);
    } else if (this.reducedMotion.addListener) {
      this.reducedMotion.addListener(motionChange);
    }

    if ("IntersectionObserver" in window) {
      this.observer = new IntersectionObserver(function (entries) {
        entries.forEach(function (entry) {
          if (entry.target !== self.root) {
            return;
          }
          self.inView = entry.isIntersecting && entry.intersectionRatio > 0;
          self.lastTimestamp = null;
          self.syncPlayback();
        });
      }, { threshold: 0.01 });
      this.observer.observe(this.root);
    }
  };

  CutoffDemo.prototype.shouldRun = function () {
    return !this.reducedMotion.matches && !this.userPaused &&
      !this.visibilityPaused && this.inView;
  };

  CutoffDemo.prototype.syncPlayback = function () {
    var shouldRun = this.shouldRun();

    if (shouldRun && !this.frame) {
      this.lastTimestamp = null;
      this.frame = window.requestAnimationFrame(this.tick.bind(this));
    } else if (!shouldRun && this.frame) {
      window.cancelAnimationFrame(this.frame);
      this.frame = 0;
      this.lastTimestamp = null;
    }

    if (this.reducedMotion.matches) {
      this.root.dataset.state = "reduced-motion";
    } else if (this.userPaused) {
      this.root.dataset.state = "paused";
    } else if (!shouldRun) {
      this.root.dataset.state = "waiting";
    } else {
      this.root.dataset.state = "running";
    }

    this.updateControls();
  };

  CutoffDemo.prototype.tick = function (timestamp) {
    this.frame = 0;
    if (!this.shouldRun()) {
      this.lastTimestamp = null;
      this.syncPlayback();
      return;
    }

    if (this.lastTimestamp !== null) {
      this.elapsed += Math.min(timestamp - this.lastTimestamp, 100);
      if (this.elapsed >= cycleDuration) {
        this.elapsed %= cycleDuration;
      }
    }
    this.lastTimestamp = timestamp;
    this.render();
    this.frame = window.requestAnimationFrame(this.tick.bind(this));
  };

  CutoffDemo.prototype.stateAt = function (time) {
    var processed = 0;
    var active = -1;
    var progress = 0;

    schedule.some(function (event, index) {
      if (time >= event.end) {
        processed = index + 1;
        return false;
      }
      if (time >= event.start) {
        active = index;
        progress = clamp((time - event.start) / MOVE_MS, 0, 1);
      }
      return true;
    });

    return {
      processed: processed,
      active: active,
      progress: progress
    };
  };

  CutoffDemo.prototype.render = function () {
    var time = this.reducedMotion.matches
      ? finalCompleteAt + 1
      : this.elapsed % cycleDuration;
    var state = this.stateAt(time);
    var eased = ease(state.progress);

    this.candidates.forEach(function (candidateElement, index) {
      var candidate = CANDIDATES[index];
      var isProcessed = index < state.processed;
      var isActive = index === state.active;
      var x;
      var y;
      var opacity = 1;
      var rejectMarkOpacity = 0;

      if (isProcessed) {
        if (candidate.outcome === "placed") {
          x = SEAT_X[candidate.seatIndex];
          y = candidate.seat === "open" ? OPEN_Y : RESERVED_Y;
        } else {
          x = REJECT_X;
          y = REJECT_Y;
          opacity = 0;
        }
      } else if (isActive) {
        var targetX = candidate.outcome === "placed"
          ? SEAT_X[candidate.seatIndex]
          : REJECT_X;
        var targetY = candidate.outcome === "placed"
          ? (candidate.seat === "open" ? OPEN_Y : RESERVED_Y)
          : REJECT_Y;
        x = QUEUE_X + (targetX - QUEUE_X) * eased;
        y = QUEUE_Y + (targetY - QUEUE_Y) * eased;

        if (candidate.outcome === "rejected") {
          rejectMarkOpacity = clamp((state.progress - 0.12) / 0.18, 0, 1);
          opacity = state.progress < 0.48
            ? 1
            : 1 - clamp((state.progress - 0.48) / 0.52, 0, 1);
        }
      } else if (state.active >= 0) {
        x = QUEUE_X + (index - state.active) * QUEUE_GAP - QUEUE_GAP * eased;
        y = QUEUE_Y;
      } else {
        x = QUEUE_X + (index - state.processed) * QUEUE_GAP;
        y = QUEUE_Y;
      }

      candidateElement.setAttribute(
        "transform",
        "translate(" + x.toFixed(2) + " " + y.toFixed(2) + ")"
      );
      candidateElement.style.opacity = clamp(opacity, 0, 1).toFixed(3);
      candidateElement.classList.toggle("is-active", isActive);
      candidateElement.classList.toggle(
        "is-placed",
        isProcessed && candidate.outcome === "placed"
      );
      candidateElement.classList.toggle(
        "is-rejecting",
        isActive && candidate.outcome === "rejected"
      );
      candidateElement.classList.toggle(
        "is-rejected",
        isProcessed && candidate.outcome === "rejected"
      );
      Array.prototype.forEach.call(
        candidateElement.querySelectorAll(".cutoff-demo__reject-mark"),
        function (mark) {
          mark.style.opacity = rejectMarkOpacity.toFixed(3);
        }
      );
    });

    var openFilled = countPlaced(state.processed, "open");
    var reservedFilled = countPlaced(state.processed, "reserved");
    var openScore = lastPlacedScore(state.processed, "open");
    var reservedScore = lastPlacedScore(state.processed, "reserved");
    this.openCutoff.textContent = openScore === null ? "-" : openScore;
    this.reservedCutoff.textContent = reservedScore === null ? "-" : reservedScore;

    this.openSeats.dataset.filled = openFilled;
    this.reservedSeats.dataset.filled = reservedFilled;
    this.root.dataset.phase = openFilled < OPEN_COUNT
      ? "open"
      : reservedFilled < RESERVED_COUNT ? "reserved" : "complete";

    var openPulse = false;
    var reservedPulse = false;
    schedule.forEach(function (event, index) {
      var candidate = CANDIDATES[index];
      if (candidate.outcome !== "placed") {
        return;
      }
      if (time >= event.end && time - event.end < 260) {
        if (candidate.seat === "open") {
          openPulse = true;
        } else {
          reservedPulse = true;
        }
      }
    });
    this.openCutoff.classList.toggle("is-updated", openPulse);
    this.reservedCutoff.classList.toggle("is-updated", reservedPulse);

    var sceneOpacity = 1;
    if (!this.reducedMotion.matches && time < FADE_MS) {
      sceneOpacity = time / FADE_MS;
    } else if (!this.reducedMotion.matches && time >= fadeAt) {
      sceneOpacity = 1 - (time - fadeAt) / FADE_MS;
    }
    this.scene.style.opacity = clamp(sceneOpacity, 0, 1).toFixed(3);

    if (state.processed !== this.lastProcessed) {
      this.lastProcessed = state.processed;
      if (this.status) {
        if (state.processed === 0) {
          this.status.textContent = "Allocation ready.";
        } else {
          var latest = CANDIDATES[state.processed - 1];
          if (latest.outcome === "rejected") {
            this.status.textContent = "General candidate with score " + latest.score +
              " discarded while the reserved seats are being filled.";
          } else if (latest.seat === "open") {
            this.status.textContent = openFilled + " of 5 Open seats filled. Open cutoff " +
              latest.score + ".";
          } else {
            this.status.textContent = reservedFilled +
              " of 5 reserved seats filled. Reserved cutoff " + latest.score + ".";
          }
        }
      }
    }
  };

  CutoffDemo.prototype.updateControls = function () {
    var self = this;
    this.toggleButtons.forEach(function (button) {
      var label = button.querySelector("[data-cutoff-demo-control-label]");
      var paused = self.userPaused;
      if (label) {
        label.textContent = paused ? "Play" : "Pause";
      }
      button.setAttribute("aria-label", paused ? "Play cutoff animation" : "Pause cutoff animation");
      button.setAttribute("aria-pressed", paused ? "true" : "false");
      button.disabled = self.reducedMotion.matches;
    });
    this.replayButtons.forEach(function (button) {
      button.disabled = self.reducedMotion.matches;
    });
  };

  CutoffDemo.prototype.pause = function () {
    if (this.reducedMotion.matches) {
      return;
    }
    this.userPaused = true;
    this.lastTimestamp = null;
    this.syncPlayback();
  };

  CutoffDemo.prototype.play = function () {
    if (this.reducedMotion.matches) {
      return;
    }
    this.userPaused = false;
    this.lastTimestamp = null;
    this.syncPlayback();
  };

  CutoffDemo.prototype.restart = function () {
    if (this.reducedMotion.matches) {
      return;
    }
    this.elapsed = 0;
    this.lastProcessed = -1;
    this.userPaused = false;
    this.lastTimestamp = null;
    this.render();
    this.syncPlayback();
  };

  CutoffDemo.prototype.toggle = function () {
    if (this.userPaused) {
      this.play();
    } else {
      this.pause();
    }
  };

  function initialise() {
    document.querySelectorAll("[data-cutoff-demo]").forEach(function (root) {
      if (root.dataset.cutoffDemoReady === "true") {
        return;
      }
      root.dataset.cutoffDemoReady = "true";
      new CutoffDemo(root);
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initialise);
  } else {
    initialise();
  }
}());
