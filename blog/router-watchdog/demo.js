(function () {
  'use strict';
  var demo = document.querySelector('.watchdog-demo');
  var circuit = demo.querySelector('.circuit');
  var button = document.getElementById('play-outage');
  var label = button.querySelector('span');
  var persists = document.getElementById('outage-persists');
  var state = document.getElementById('demo-state');
  var detail = document.getElementById('demo-detail');
  var stages = Array.prototype.slice.call(demo.querySelectorAll('[data-step]'));
  var timers = [];
  var running = false;
  var completed = false;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  var stepIndex = 0;
  var sequence = [];

  function clearTimers() {
    timers.forEach(window.clearTimeout);
    timers = [];
  }

  function show(phase, title, description, index) {
    demo.dataset.phase = phase;
    circuit.dataset.phase = phase;
    state.textContent = title;
    detail.textContent = description;
    stages.forEach(function (stage, i) {
      stage.classList.toggle('active', i === index);
      stage.classList.toggle('done', i < index);
    });
  }

  function reset() {
    clearTimers();
    running = false;
    completed = false;
    persists.disabled = false;
    demo.dataset.running = 'false';
    delete demo.dataset.result;
    label.textContent = 'Try an outage';
    show('healthy', 'Internet reachable', 'Router powered. Watchdog watching.', -1);
  }

  function finish() {
    running = false;
    completed = true;
    demo.dataset.running = 'false';
    demo.dataset.result = persists.checked ? 'held' : 'recovered';
    persists.disabled = false;
    label.textContent = 'Reset demo';
  }

  function showStep(index) {
    stepIndex = index;
    show.apply(null, sequence[index]);
    if (index === sequence.length - 1) {
      finish();
    } else {
      label.textContent = reduceMotion.matches ? 'Next step' : 'Reset demo';
    }
  }

  button.addEventListener('click', function () {
    if (running && reduceMotion.matches) {
      showStep(stepIndex + 1);
      return;
    }
    if (running || completed) {
      reset();
      return;
    }
    running = true;
    persists.disabled = true;
    demo.dataset.running = 'true';
    sequence = [
      ['qualify', 'Connection checks failing', 'Wait for three continuous minutes of failed checks.', 0],
      ['cut', 'Relay open. Router off.', 'Attempt saved first. Power interruption set to 30 seconds.', 1],
      ['boot', 'Power restored', 'Give the router five minutes to boot.', 2],
      persists.checked
        ? ['held', 'Still down. Leave the router on.', 'One attempt used. No more restarts during this unresolved outage.', 3]
        : ['healthy', 'Internet reachable again', 'Keep watching. Ten healthy minutes clear the outage latch.', 3]
    ];
    showStep(0);
    if (!reduceMotion.matches) {
      [2500, 4500, 7500].forEach(function (delay, index) {
        timers.push(window.setTimeout(function () { showStep(index + 1); }, delay));
      });
    }
  });

  reduceMotion.addEventListener('change', function () {
    if (running) reset();
  });
  demo.querySelector('.demo-controls').hidden = false;
}());
