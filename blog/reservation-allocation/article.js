(function () {
  "use strict";

  var body = document.body;
  var root = document.documentElement;
  var readerToolbar = document.querySelector(".reader-toolbar");
  var deck = document.getElementById("storyDeck");
  var cards = Array.prototype.slice.call(deck.querySelectorAll(".story-card"));
  var modeButtons = Array.prototype.slice.call(document.querySelectorAll("[data-set-mode]"));
  var previousButton = document.getElementById("previousCard");
  var nextButton = document.getElementById("nextCard");
  var cardCount = document.getElementById("cardCount");
  var cardTitle = document.getElementById("cardTitle");
  var progressFill = document.getElementById("deckProgressFill");
  var announcement = document.getElementById("cardAnnouncement");
  var cardScrollCue = document.getElementById("cardScrollCue");
  var themeToggle = document.getElementById("themeToggle");
  var params = new URLSearchParams(window.location.search);
  var activeIndex = 0;
  var mode = "article";
  var scrollFrame = 0;
  var announceTimer = 0;
  var articleObserver = null;
  var framePhases = new WeakMap();
  var autoPausedFrames = new WeakSet();
  var startedWithHash = Boolean(window.location.hash);

  function updateCardScrollCue() {
    if (mode !== "cards") {
      cardScrollCue.dataset.visible = "false";
      return;
    }

    var card = cards[activeIndex];
    var hasMore = card.scrollHeight - card.clientHeight > 8
      && card.scrollTop + card.clientHeight < card.scrollHeight - 8;
    cardScrollCue.dataset.visible = hasMore ? "true" : "false";
  }

  function preferredTheme() {
    var saved = null;
    try {
      saved = localStorage.getItem("theme");
    } catch (error) {
      saved = null;
    }
    if (saved === "dark" || saved === "light") {
      return saved;
    }
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  function currentTheme() {
    return body.classList.contains("dark") ? "dark" : "light";
  }

  function sendTheme(frame) {
    if (!frame.contentWindow) {
      return;
    }
    frame.contentWindow.postMessage({
      type: "reservation-animation-theme",
      theme: currentTheme()
    }, "*");
  }

  function setTheme(theme) {
    var isDark = theme === "dark";
    var icon = themeToggle.querySelector("[data-theme-icon]");
    var label = themeToggle.querySelector("[data-theme-label]");
    var action = isDark ? "Use light theme" : "Use dark theme";
    root.classList.toggle("dark", isDark);
    body.classList.toggle("dark", isDark);
    try {
      localStorage.setItem("theme", isDark ? "dark" : "light");
    } catch (error) {
      // The selected theme still applies when storage is unavailable.
    }
    if (icon) {
      icon.textContent = isDark ? "☀" : "☾";
    }
    if (label) {
      label.textContent = isDark ? "Light" : "Dark";
    }
    themeToggle.setAttribute("aria-label", action);
    themeToggle.setAttribute("title", action);
    document.querySelector('meta[name="theme-color"]').setAttribute(
      "content",
      isDark ? "#181a1d" : "#f7f6f1"
    );
    document.querySelectorAll("[data-animation-frame][src]").forEach(sendTheme);
  }

  setTheme(preferredTheme());

  themeToggle.addEventListener("click", function () {
    setTheme(currentTheme() === "dark" ? "light" : "dark");
  });

  function frameView(frame) {
    var source = frame.dataset.src || frame.getAttribute("src") || "";
    if (source.indexOf("view=oa") !== -1) {
      return "oa";
    }
    if (source.indexOf("view=mg") !== -1) {
      return "mg";
    }
    return "compare";
  }

  function loadFrame(frame) {
    if (frame.dataset.loaded === "true") {
      sendTheme(frame);
      return;
    }

    var source = frame.dataset.src;
    if (!source) {
      return;
    }

    var url = new URL(source, window.location.href);
    url.searchParams.set("theme", currentTheme());
    frame.dataset.loaded = "true";
    frame.dataset.animationView = frameView(frame);
    frame.addEventListener("load", function onLoad() {
      frame.dataset.ready = "true";
      sendTheme(frame);
    });
    frame.src = url.href;
  }

  function loadFramesInCard(card) {
    card.querySelectorAll("[data-animation-frame]").forEach(loadFrame);
  }

  function setupArticleObserver() {
    if (articleObserver) {
      articleObserver.disconnect();
    }
    articleObserver = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          loadFramesInCard(entry.target);
        }
      });
    }, { rootMargin: "320px 0px", threshold: 0.01 });

    cards.forEach(function (card) {
      if (card.querySelector("[data-animation-frame]")) {
        articleObserver.observe(card);
      }
    });
  }

  function cardScrollLeft(index) {
    var leftPadding = parseFloat(window.getComputedStyle(deck).paddingLeft) || 0;
    return cards[index].offsetLeft - leftPadding;
  }

  function resetRootScroll() {
    root.scrollTop = 0;
    body.scrollTop = 0;
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }

  function writeActiveHash() {
    history.replaceState(null, "", window.location.pathname + window.location.search + "#" + cards[activeIndex].id);
  }

  function pauseDepartingAnimation(previousIndex, nextIndex) {
    if (previousIndex === nextIndex || mode !== "cards") {
      return;
    }

    var previousFrame = cards[previousIndex] && cards[previousIndex].querySelector("[data-animation-frame]");
    if (previousFrame && framePhases.get(previousFrame) === "running") {
      previousFrame.contentWindow.postMessage({
        type: "reservation-animation-control",
        action: "toggle"
      }, "*");
      autoPausedFrames.add(previousFrame);
    }
  }

  function resumeArrivingAnimation(index) {
    var frame = cards[index].querySelector("[data-animation-frame]");
    if (frame && autoPausedFrames.has(frame) && framePhases.get(frame) === "paused") {
      frame.contentWindow.postMessage({
        type: "reservation-animation-control",
        action: "toggle"
      }, "*");
      autoPausedFrames.delete(frame);
    }
  }

  function updateCardUI(index, announce) {
    var previousIndex = activeIndex;
    activeIndex = Math.max(0, Math.min(cards.length - 1, index));

    pauseDepartingAnimation(previousIndex, activeIndex);
    loadFramesInCard(cards[activeIndex]);
    resumeArrivingAnimation(activeIndex);

    cardCount.textContent = String(activeIndex + 1).padStart(2, "0") + " / " + cards.length;
    cardTitle.textContent = cards[activeIndex].dataset.title;
    progressFill.style.width = ((activeIndex + 1) / cards.length * 100) + "%";
    previousButton.disabled = activeIndex === 0;
    nextButton.textContent = activeIndex === cards.length - 1 ? "↻" : "→";
    nextButton.setAttribute("aria-label", activeIndex === cards.length - 1 ? "Start again" : "Next card");

    if (mode === "cards") {
      cards.forEach(function (card, cardIndex) {
        card.inert = cardIndex !== activeIndex;
        card.setAttribute("aria-hidden", cardIndex === activeIndex ? "false" : "true");
      });
    }

    window.requestAnimationFrame(updateCardScrollCue);

    if (document.readyState === "complete") {
      writeActiveHash();
    }

    if (announce) {
      window.clearTimeout(announceTimer);
      announceTimer = window.setTimeout(function () {
        announcement.textContent = "Card " + (activeIndex + 1) + " of " + cards.length + ": " + cards[activeIndex].dataset.title;
      }, 160);
    }
  }

  function goToCard(index, behavior) {
    var target = Math.max(0, Math.min(cards.length - 1, index));
    var nextBehavior = behavior || (window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth");
    if (nextBehavior === "auto") {
      var previousScrollBehavior = deck.style.scrollBehavior;
      deck.style.scrollBehavior = "auto";
      deck.scrollLeft = cardScrollLeft(target);
      window.requestAnimationFrame(function () {
        deck.style.scrollBehavior = previousScrollBehavior;
      });
    } else {
      deck.scrollTo({ left: cardScrollLeft(target), behavior: nextBehavior });
    }
    updateCardUI(target, true);
  }

  function nearestCardToArticleViewport() {
    var targetLine = window.innerHeight * 0.33;
    var bestIndex = 0;
    var bestDistance = Infinity;
    cards.forEach(function (card, index) {
      var distance = Math.abs(card.getBoundingClientRect().top - targetLine);
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });
    return bestIndex;
  }

  function setMode(nextMode, remember, preserveIndex) {
    if (nextMode !== "cards" && nextMode !== "article") {
      return;
    }

    var wasCards = mode === "cards";
    if (!preserveIndex && !wasCards && nextMode === "cards") {
      activeIndex = nearestCardToArticleViewport();
    }

    if (nextMode === "cards") {
      resetRootScroll();
    }
    mode = nextMode;
    root.dataset.readerMode = mode;
    body.dataset.mode = mode;
    modeButtons.forEach(function (button) {
      button.setAttribute("aria-pressed", button.dataset.setMode === mode ? "true" : "false");
    });

    if (remember) {
      localStorage.setItem("reservation-reading-mode", mode);
    }

    if (mode === "cards") {
      if (articleObserver) {
        articleObserver.disconnect();
      }
      resetRootScroll();
      window.requestAnimationFrame(function () {
        resetRootScroll();
        goToCard(activeIndex, "auto");
      });
    } else {
      cardScrollCue.dataset.visible = "false";
      cards.forEach(function (card) {
        card.inert = false;
        card.removeAttribute("aria-hidden");
      });
      setupArticleObserver();
      if (wasCards) {
        window.requestAnimationFrame(function () {
          window.requestAnimationFrame(function () {
            var absoluteTop = cards[activeIndex].getBoundingClientRect().top + window.scrollY;
            var root = document.documentElement;
            var previousScrollBehavior = root.style.scrollBehavior;
            root.style.scrollBehavior = "auto";
            window.scrollTo({
              top: Math.max(0, absoluteTop - readerToolbar.getBoundingClientRect().height),
              behavior: "auto"
            });
            window.requestAnimationFrame(function () {
              root.style.scrollBehavior = previousScrollBehavior;
            });
          });
        });
      }
    }
  }

  modeButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      setMode(button.dataset.setMode, true);
    });
  });

  previousButton.addEventListener("click", function () {
    goToCard(activeIndex - 1);
  });

  nextButton.addEventListener("click", function () {
    goToCard(activeIndex === cards.length - 1 ? 0 : activeIndex + 1);
  });

  deck.addEventListener("scroll", function () {
    if (mode !== "cards" || scrollFrame) {
      return;
    }
    scrollFrame = window.requestAnimationFrame(function () {
      scrollFrame = 0;
      var leftPadding = parseFloat(window.getComputedStyle(deck).paddingLeft) || 0;
      var target = deck.scrollLeft + leftPadding;
      var closest = 0;
      var distance = Infinity;
      cards.forEach(function (card, index) {
        var currentDistance = Math.abs(card.offsetLeft - target);
        if (currentDistance < distance) {
          distance = currentDistance;
          closest = index;
        }
      });
      if (closest !== activeIndex) {
        updateCardUI(closest, true);
      }
    });
  }, { passive: true });

  window.addEventListener("resize", function () {
    if (mode === "cards") {
      window.requestAnimationFrame(function () {
        deck.scrollTo({ left: cardScrollLeft(activeIndex), behavior: "auto" });
      });
    }
    window.requestAnimationFrame(updateCardScrollCue);
  });

  window.addEventListener("load", function () {
    if (startedWithHash) {
      writeActiveHash();
    }
    if (mode === "cards") {
      resetRootScroll();
      window.requestAnimationFrame(resetRootScroll);
    }
  });

  window.addEventListener("pageshow", function () {
    if (mode === "cards") {
      resetRootScroll();
      window.requestAnimationFrame(resetRootScroll);
    }
  });

  cards.forEach(function (card) {
    card.addEventListener("scroll", updateCardScrollCue, { passive: true });
  });

  document.querySelectorAll("details").forEach(function (details) {
    details.addEventListener("toggle", function () {
      window.requestAnimationFrame(updateCardScrollCue);
    });
  });

  document.addEventListener("keydown", function (event) {
    if (mode !== "cards") {
      return;
    }
    var tagName = event.target.tagName;
    if (/^(BUTTON|A|INPUT|TEXTAREA|SELECT|SUMMARY)$/.test(tagName)) {
      return;
    }
    if (event.key === "ArrowRight") {
      event.preventDefault();
      goToCard(activeIndex === cards.length - 1 ? 0 : activeIndex + 1);
    } else if (event.key === "ArrowLeft") {
      event.preventDefault();
      goToCard(activeIndex - 1);
    }
  });

  document.querySelectorAll("[data-animation-action]").forEach(function (button) {
    button.addEventListener("click", function () {
      var frame = button.closest(".story-card").querySelector("[data-animation-frame]");
      if (!frame) {
        return;
      }
      loadFrame(frame);
      var action = button.dataset.animationAction;
      var sendControl = function () {
        frame.contentWindow.postMessage({
          type: "reservation-animation-control",
          action: action
        }, "*");
      };
      if (frame.dataset.ready === "true") {
        sendControl();
      } else {
        frame.addEventListener("load", sendControl, { once: true });
      }
    });
  });

  function updateVacancyPanel(view, state) {
    var panel = document.querySelector('[data-progress-view="' + view + '"]');
    if (!panel || !state || !state.counts) {
      return;
    }

    var totalNode = panel.querySelector("[data-total]");
    if (totalNode) {
      totalNode.textContent = String(Number(state.total) || 0);
    }

    ["open", "obc", "scst"].forEach(function (pool) {
      var row = panel.querySelector('[data-pool="' + pool + '"]');
      if (!row) {
        return;
      }
      var count = Number(state.counts[pool]) || 0;
      var capacity = Number(row.dataset.capacity) || 1;
      row.querySelector("[data-count]").textContent = String(count);
      row.querySelector("[data-fill]").style.width = Math.min(100, count / capacity * 100) + "%";
      var cutoff = state.cutoffs && state.cutoffs[pool];
      row.querySelector("[data-cutoff]").textContent = cutoff == null ? "-" : String(cutoff);
    });
  }

  window.addEventListener("message", function (event) {
    var message = event.data;
    if (!message || message.type !== "reservation-animation-progress") {
      return;
    }

    var sourceFrame = Array.prototype.find.call(document.querySelectorAll("[data-animation-frame]"), function (frame) {
      return frame.contentWindow === event.source;
    });
    if (sourceFrame) {
      framePhases.set(sourceFrame, message.phase);
      var control = sourceFrame.closest(".story-card").querySelector('[data-animation-action="toggle"]');
      if (control) {
        control.textContent = message.phase === "paused" ? "Play" : "Pause";
      }
    }

    if (message.view === "oa") {
      updateVacancyPanel("oa", message.current);
    } else if (message.view === "mg") {
      updateVacancyPanel("mg", message.proposed);
    }
  });

  var hashIndex = cards.findIndex(function (card) {
    return "#" + card.id === window.location.hash;
  });
  if (hashIndex >= 0) {
    activeIndex = hashIndex;
  }

  var requestedMode = params.get("mode");
  var storedMode = localStorage.getItem("reservation-reading-mode");
  var cardFriendlyViewport = window.matchMedia("(max-width: 700px) and (min-height: 700px)").matches;
  var initialMode = requestedMode === "cards" || requestedMode === "article"
    ? requestedMode
    : (storedMode === "cards" || storedMode === "article"
      ? storedMode
      : (cardFriendlyViewport ? "cards" : "article"));

  mode = initialMode === "cards" ? "article" : "cards";
  setMode(initialMode, false, true);
  updateCardUI(activeIndex, false);
}());
