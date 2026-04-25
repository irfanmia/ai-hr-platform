"use client";

/**
 * Re-implements the original app.js DOM interactions for the landing page.
 *
 * The marketing HTML body is server-rendered via dangerouslySetInnerHTML,
 * so by the time this client component's useEffect fires, every selector
 * that the original script targets is already present in the DOM.
 *
 * What runs here:
 *   - Reveal-on-scroll IntersectionObserver
 *   - Hero interview widget: typing animation across 3 sample questions
 *   - "How it works" tab + step rotator (candidate / hiring team) + frame swap
 *   - Resume drop-zone scan animation triggered when step 02 lands
 *   - Integrations tab switcher
 *   - Animated stat counters
 *   - QR placeholder (deterministic 5x5 mock for the fraud panel)
 *
 * Returns null — pure side-effects.
 */
import { useEffect } from "react";

const HERO_QS: Array<{ q: string; a: string }> = [
  {
    q: "Walk me through how you'd debug a production service that's intermittently returning 502s only during peak load.",
    a: "I'd start by checking the load balancer's upstream timeouts against the service's actual p99 latency under load. Often the upstream is fine but the LB is being too aggressive. Then I'd look at connection pool exhaustion — if the pool size is below max concurrency, requests queue and time out…",
  },
  {
    q: "Describe a time you disagreed with a senior engineer's design decision. What did you do?",
    a: "We were picking between Kafka and a managed queue for our event pipeline. The lead favoured Kafka but our throughput was 200 events per second — wildly over-engineered. I built a one-week proof-of-concept on SQS, ran the numbers on operational cost…",
  },
  {
    q: "Your service drops requests when an upstream dependency slows down. How would you redesign it?",
    a: "Two layers: first, circuit breakers around every outbound call with sensible half-open windows. Second, decouple the read path from the write path — the slow upstream shouldn't block reads we can serve from cache…",
  },
];

export function LandingBootstrap() {
  useEffect(() => {
    // ---------- Reveal on scroll ----------
    const reveals = document.querySelectorAll(
      ".reveal, .reveal-stagger, .gauge, .radar, .skill-list",
    );
    const revealObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            revealObs.unobserve(e.target);
          }
        });
      },
      { threshold: 0.15, rootMargin: "0px 0px -60px 0px" },
    );
    reveals.forEach((n) => revealObs.observe(n));

    // ---------- Hero interview widget — typing animation ----------
    const qEl = document.querySelector<HTMLElement>(".iw-q");
    const aEl = document.querySelector<HTMLElement>(".iw-answer-text");
    const progressEls = document.querySelectorAll<HTMLElement>(".iw-progress span");
    const timerEl = document.querySelector<HTMLElement>(".iw-cam .timer");

    let qIdx = 0;
    let typing: ReturnType<typeof setInterval> | null = null;
    let nextRunTimer: ReturnType<typeof setTimeout> | null = null;
    let typeDoneTimer: ReturnType<typeof setTimeout> | null = null;

    function typeInto(
      el: HTMLElement | null,
      text: string,
      speed: number,
      done?: () => void,
    ) {
      if (!el) return;
      el.innerHTML = "";
      let i = 0;
      if (typing) clearInterval(typing);
      typing = setInterval(() => {
        i++;
        el.innerHTML =
          text.slice(0, i) + (i < text.length ? '<span class="cursor"></span>' : "");
        if (i >= text.length) {
          if (typing) clearInterval(typing);
          typing = null;
          if (done) typeDoneTimer = setTimeout(done, 1400);
        }
      }, speed);
    }

    function setProgress(idx: number) {
      progressEls.forEach((p, i) => {
        p.classList.remove("done", "cur");
        if (i < idx) p.classList.add("done");
        else if (i === idx) p.classList.add("cur");
      });
    }

    function runQuestion() {
      const item = HERO_QS[qIdx % HERO_QS.length];
      setProgress((qIdx % HERO_QS.length) + 3);
      if (aEl) aEl.innerHTML = '<span class="ph">listening…</span>';
      typeInto(qEl, item.q, 24, () => {
        typeInto(aEl, item.a, 16, () => {
          qIdx++;
          nextRunTimer = setTimeout(runQuestion, 2200);
        });
      });
    }

    let heroObs: IntersectionObserver | null = null;
    if (qEl) {
      heroObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              runQuestion();
              heroObs?.disconnect();
            }
          });
        },
        { threshold: 0.3 },
      );
      heroObs.observe(qEl);
    }

    // Mock REC timer
    let timerSec = 0;
    const timerInt = setInterval(() => {
      timerSec = (timerSec + 1) % 600;
      const m = String(Math.floor(timerSec / 60)).padStart(2, "0");
      const s = String(timerSec % 60).padStart(2, "0");
      if (timerEl) timerEl.textContent = `REC ${m}:${s}`;
    }, 1000);

    // ---------- How it works tabs + steps ----------
    const tabs = document.querySelectorAll<HTMLButtonElement>(".how-tabs button");
    const steps = document.querySelectorAll<HTMLElement>(".how-step");
    const frames = document.querySelectorAll<HTMLElement>(".how-frame");

    let currentTab = "candidate";
    let currentStep = 0;
    let stepTimer: ReturnType<typeof setInterval> | null = null;

    function showFrame(name: string) {
      frames.forEach((f) => {
        if (f.dataset.frame === name) f.classList.add("show");
        else f.classList.remove("show");
      });
    }

    function setStep(idx: number, manual = false) {
      const visible = Array.from(steps).filter((s) => s.dataset.tab === currentTab);
      visible.forEach((s, i) => s.classList.toggle("active", i === idx));
      const target = visible[idx];
      if (target?.dataset.frame) showFrame(target.dataset.frame);
      currentStep = idx;
      if (manual) {
        if (stepTimer) clearInterval(stepTimer);
        startStepTimer();
      }
    }

    function setTab(name: string) {
      currentTab = name;
      tabs.forEach((t) => t.classList.toggle("active", t.dataset.tab === name));
      steps.forEach((s) => {
        s.style.display = s.dataset.tab === name ? "" : "none";
      });
      setStep(0);
    }

    function animateResume() {
      const dz = document.querySelector<HTMLElement>(".dropzone");
      const bar = document.querySelector<HTMLElement>(".scan-bar i");
      const sub = document.querySelector<HTMLElement>(".dropzone .sub");
      if (!dz || !bar || !sub) return;
      dz.classList.remove("ok");
      dz.classList.add("scan");
      bar.style.width = "0%";
      sub.textContent = "validating document…";
      requestAnimationFrame(() => {
        bar.style.width = "100%";
      });
      setTimeout(() => {
        dz.classList.remove("scan");
        dz.classList.add("ok");
        sub.textContent = "✓ accepted — software-engineer cv detected";
      }, 1600);
    }

    function startStepTimer() {
      if (stepTimer) clearInterval(stepTimer);
      stepTimer = setInterval(() => {
        const visible = Array.from(steps).filter((s) => s.dataset.tab === currentTab);
        setStep((currentStep + 1) % visible.length);
        if (currentTab === "candidate" && currentStep === 1) animateResume();
      }, 4500);
    }

    const tabClickHandlers: Array<[HTMLButtonElement, () => void]> = [];
    tabs.forEach((t) => {
      const h = () => setTab(t.dataset.tab || "candidate");
      t.addEventListener("click", h);
      tabClickHandlers.push([t, h]);
    });
    const stepClickHandlers: Array<[HTMLElement, () => void]> = [];
    steps.forEach((s) => {
      const h = () => {
        const visible = Array.from(steps).filter((x) => x.dataset.tab === currentTab);
        const idx = visible.indexOf(s);
        if (idx >= 0) setStep(idx, true);
      };
      s.addEventListener("click", h);
      stepClickHandlers.push([s, h]);
    });

    let howObs: IntersectionObserver | null = null;
    const howSection = document.querySelector(".how");
    if (howSection) {
      howObs = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              setTab("candidate");
              startStepTimer();
              howObs?.disconnect();
            }
          });
        },
        { threshold: 0.3 },
      );
      howObs.observe(howSection);
    }

    // ---------- Integrations tabs ----------
    const intTabs = document.querySelectorAll<HTMLButtonElement>(".int-tabs button");
    const intGroups = document.querySelectorAll<HTMLElement>("[data-int-group]");
    const intHandlers: Array<[HTMLButtonElement, () => void]> = [];
    intTabs.forEach((t) => {
      const h = () => {
        intTabs.forEach((x) => x.classList.toggle("active", x === t));
        intGroups.forEach((g) => {
          g.style.display = g.dataset.intGroup === t.dataset.group ? "" : "none";
        });
      };
      t.addEventListener("click", h);
      intHandlers.push([t, h]);
    });

    // ---------- Animated stat counters ----------
    const counters = document.querySelectorAll<HTMLElement>("[data-count]");
    const counterObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            const el = e.target as HTMLElement;
            const target = parseFloat(el.dataset.count || "0");
            const suffix = el.dataset.suffix || "";
            const decimals = parseInt(el.dataset.decimals || "0", 10);
            const dur = 1400;
            const start = performance.now();
            const step = (now: number) => {
              const t = Math.min(1, (now - start) / dur);
              const eased = 1 - Math.pow(1 - t, 3);
              const v = target * eased;
              el.textContent = v.toFixed(decimals) + suffix;
              if (t < 1) requestAnimationFrame(step);
            };
            requestAnimationFrame(step);
            counterObs.unobserve(el);
          }
        });
      },
      { threshold: 0.5 },
    );
    counters.forEach((c) => counterObs.observe(c));

    // ---------- QR mock for the fraud panel ----------
    const qr = document.getElementById("qr");
    if (qr && qr.children.length === 0) {
      const seed = "HP-A48C20-2026-04-25";
      let h = 0;
      for (let i = 0; i < seed.length; i++) h = ((h * 31 + seed.charCodeAt(i)) | 0);
      for (let i = 0; i < 25; i++) {
        const cell = document.createElement("i");
        const r = Math.floor(i / 5);
        const c = i % 5;
        let on = ((h >> i) & 1) === 1;
        if ((r === 0 && c === 0) || (r === 0 && c === 4) || (r === 4 && c === 0)) {
          on = true;
        }
        if (!on) cell.style.background = "transparent";
        qr.appendChild(cell);
      }
    }

    // ---------- Cleanup ----------
    return () => {
      revealObs.disconnect();
      heroObs?.disconnect();
      howObs?.disconnect();
      counterObs.disconnect();
      if (typing) clearInterval(typing);
      if (nextRunTimer) clearTimeout(nextRunTimer);
      if (typeDoneTimer) clearTimeout(typeDoneTimer);
      if (stepTimer) clearInterval(stepTimer);
      clearInterval(timerInt);
      tabClickHandlers.forEach(([el, h]) => el.removeEventListener("click", h));
      stepClickHandlers.forEach(([el, h]) => el.removeEventListener("click", h));
      intHandlers.forEach(([el, h]) => el.removeEventListener("click", h));
      document.body.style.overflow = "";
    };
  }, []);

  return null;
}
