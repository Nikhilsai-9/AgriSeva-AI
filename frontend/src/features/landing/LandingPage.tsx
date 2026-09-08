import React, { useEffect } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/stores/auth-store";

export function LandingPage() {
  const navigate = useNavigate();
  const { user } = useAuthStore();

  useEffect(() => {
    // Attach simulation and modal handlers to window for complete fidelity with original platform
    const w = window as any;

    w.openDemoModal = function () {
      const modal = document.getElementById("demoModal");
      if (modal) {
        modal.classList.add("active");
        document.body.style.overflow = "hidden";
      }
    };

    w.closeDemoModal = function () {
      const modal = document.getElementById("demoModal");
      if (modal) {
        modal.classList.remove("active");
        document.body.style.overflow = "";
      }
    };

    w.handleModalClick = function (e: any) {
      if (e && e.target && e.target.id === "demoModal") {
        w.closeDemoModal();
      }
    };

    w.toggleFaq = function (el: HTMLElement) {
      if (!el) return;
      const answer = el.querySelector(".a") as HTMLElement | null;
      const pm = el.querySelector(".pm") as HTMLElement | null;
      if (!answer) return;

      if (answer.style.display === "none" || !answer.style.display) {
        answer.style.display = "block";
        if (pm) pm.style.transform = "rotate(45deg)";
      } else {
        answer.style.display = "none";
        if (pm) pm.style.transform = "rotate(0deg)";
      }
    };

    w.updateSim = function () {
      const slideRain = document.getElementById("slideRain") as HTMLInputElement | null;
      const slideWater = document.getElementById("slideWater") as HTMLInputElement | null;
      const slideFert = document.getElementById("slideFert") as HTMLInputElement | null;
      const slidePrice = document.getElementById("slidePrice") as HTMLInputElement | null;

      if (!slideRain || !slideWater || !slideFert || !slidePrice) return;

      const rain = parseInt(slideRain.value, 10);
      const water = parseInt(slideWater.value, 10);
      const fert = parseInt(slideFert.value, 10);
      const price = parseInt(slidePrice.value, 10);

      const valRain = document.getElementById("valRain");
      const valWater = document.getElementById("valWater");
      const valFert = document.getElementById("valFert");
      const valPrice = document.getElementById("valPrice");

      if (valRain) valRain.textContent = (rain > 0 ? "+" : "") + rain + "%";
      if (valWater) valWater.textContent = water + "%";
      if (valFert) valFert.textContent = (fert > 0 ? "+" : "") + fert + "%";
      if (valPrice) valPrice.textContent = (price > 0 ? "+" : "") + price + "%";

      // Simulation mathematical model ported directly from simulation engine
      const baseYield = 4.0; // t/ha
      const yieldFactor = 1 + rain * 0.008 + (water - 100) * 0.005;
      const simYield = Math.max(1.5, baseYield * yieldFactor).toFixed(2);

      const basePrice = 350; // $/ton
      const simPrice = basePrice * (1 + price * 0.01);
      const simRev = Math.round(Number(simYield) * simPrice);

      const baseCost = 650;
      const simCost = Math.round(baseCost * (1 + fert * 0.006));
      const simProfit = simRev - simCost;

      const resYield = document.getElementById("resYield");
      const resRev = document.getElementById("resRev");
      const resProfit = document.getElementById("resProfit");

      if (resYield) resYield.textContent = simYield + " t/ha";
      if (resRev) resRev.textContent = "$" + simRev.toLocaleString() + "/ha";
      if (resProfit) {
        resProfit.textContent = "$" + simProfit.toLocaleString() + "/ha";
        if (simProfit < 200) {
          resProfit.style.color = "#c53030";
        } else {
          resProfit.style.color = "var(--green-deep)";
        }
      }

      const riskBadge = document.getElementById("resRisk");
      const explainEl = document.getElementById("resExplain");

      if (riskBadge && explainEl) {
        if (rain < -20 || water < 65 || simProfit < 250) {
          riskBadge.textContent = "High";
          riskBadge.style.background = "#feebc8";
          riskBadge.style.color = "#c05621";
          explainEl.textContent =
            "Severe water deficit detected. Recommend drought-tolerant crop cultivar and protective mulch application to hedge against yield collapse.";
        } else if (rain < 0 || fert > 20 || water < 85) {
          riskBadge.textContent = "Moderate";
          riskBadge.style.background = "#eafaf1";
          riskBadge.style.color = "var(--green-deep)";
          explainEl.textContent = `Under ${rain}% rainfall and ${
            fert > 0 ? "+" : ""
          }${fert}% input cost, adopting deficit irrigation with split-nitrogen application preserves net profit while curtailing volatility.`;
        } else {
          riskBadge.textContent = "Low";
          riskBadge.style.background = "#e6fffa";
          riskBadge.style.color = "#234e52";
          explainEl.textContent =
            "Optimal soil and moisture conditions projected. Maximize standard nutrient input to capitalize on favorable harvest price margins.";
        }
      }
    };

    w.resetSim = function () {
      const slideRain = document.getElementById("slideRain") as HTMLInputElement | null;
      const slideWater = document.getElementById("slideWater") as HTMLInputElement | null;
      const slideFert = document.getElementById("slideFert") as HTMLInputElement | null;
      const slidePrice = document.getElementById("slidePrice") as HTMLInputElement | null;

      if (slideRain) slideRain.value = "0";
      if (slideWater) slideWater.value = "100";
      if (slideFert) slideFert.value = "0";
      if (slidePrice) slidePrice.value = "0";

      w.updateSim();
    };

    // Attach click listeners to all data-nav-auth buttons
    const authButtons = document.querySelectorAll("[data-nav-auth]");
    const handleAuthClick = (e: Event) => {
      e.preventDefault();
      navigate({ to: "/auth" });
    };
    authButtons.forEach((btn) => btn.addEventListener("click", handleAuthClick));

    return () => {
      authButtons.forEach((btn) => btn.removeEventListener("click", handleAuthClick));
    };
  }, [navigate]);

  return (
    <div className="agriseva-landing-wrapper w-full min-h-screen">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800&display=swap');

        .agriseva-landing-wrapper {
          --ink: #16241c;
          --green: #1f9d63;
          --green-deep: #137a4c;
          --green-light: #6fd99a;
          --teal: #18b3a3;
          --paper: #f3f5f2;
          --grey-faint: #c4cdc7;
          font-family: 'Inter', system-ui, sans-serif;
          background: var(--paper);
          color: var(--ink);
        }

        .agriseva-landing-wrapper * {
          box-sizing: border-box;
        }

        .agriseva-landing-wrapper .page {
          position: relative;
          width: 100%;
          overflow: hidden;
        }

        /* ---------- HERO ---------- */
        .agriseva-landing-wrapper .hero {
          position: relative;
          width: 100%;
          min-height: 980px;
          background:
            radial-gradient(ellipse 55% 42% at 86% 40%, rgba(80,215,150,0.55), transparent 70%),
            radial-gradient(ellipse 50% 40% at 22% 78%, rgba(31,157,99,0.70), transparent 70%),
            radial-gradient(ellipse 65% 45% at 58% 104%, rgba(24,179,163,0.85), transparent 72%),
            radial-gradient(ellipse 85% 50% at 50% 128%, #13a06a, transparent 60%),
            linear-gradient(to bottom, #f1f4f0 0%, #e7f0ea 28%, #84d6a8 64%, #54c7b6 90%, #6fdcc0 100%);
          overflow: hidden;
        }

        /* dot-grid texture on lower half */
        .agriseva-landing-wrapper .dots {
          position: absolute;
          inset: 0;
          background-image: radial-gradient(circle, rgba(255,255,255,0.28) 2px, transparent 2px);
          background-size: 30px 30px;
          -webkit-mask-image: linear-gradient(to bottom, transparent 42%, #000 66%, #000 100%);
          mask-image: linear-gradient(to bottom, transparent 42%, #000 66%, #000 100%);
          pointer-events: none;
        }

        /* ---------- NAV ---------- */
        .agriseva-landing-wrapper .nav {
          position: relative;
          z-index: 3;
          max-width: 1200px;
          margin: 0 auto;
          padding: 38px 64px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }
        .agriseva-landing-wrapper .brand {
          font-family: 'Poppins', sans-serif;
          font-weight: 700;
          font-size: 30px;
          letter-spacing: -0.5px;
          color: var(--ink);
          display: flex;
          align-items: center;
          gap: 12px;
          text-decoration: none;
        }
        .agriseva-landing-wrapper .brand .brand-logo-img {
          width: 38px;
          height: 38px;
          object-fit: contain;
          display: block;
        }
        .agriseva-landing-wrapper .navlinks {
          display: flex;
          gap: 42px;
          font-weight: 600;
          font-size: 17px;
          color: #33493c;
        }
        .agriseva-landing-wrapper .navlinks a { text-decoration: none; color: inherit; transition: color .2s; }
        .agriseva-landing-wrapper .navlinks a:hover { color: var(--green-deep); }
        .agriseva-landing-wrapper .cart {
          display: inline-flex;
          align-items: center;
          gap: 10px;
          background: var(--ink);
          color: #fff;
          border: none;
          padding: 13px 24px;
          border-radius: 999px;
          font-weight: 600;
          font-size: 16px;
          cursor: pointer;
          box-shadow: 0 10px 26px rgba(20,40,28,0.28);
          transition: transform .2s, box-shadow .2s;
          text-decoration: none;
        }
        .agriseva-landing-wrapper .cart:hover {
          transform: translateY(-2px);
          box-shadow: 0 14px 30px rgba(20,40,28,0.36);
        }

        /* ---------- HERO CONTENT ---------- */
        .agriseva-landing-wrapper .hero-inner {
          position: relative;
          z-index: 2;
          max-width: 1200px;
          margin: 0 auto;
          padding: 80px 64px 60px;
          text-align: center;
        }
        .agriseva-landing-wrapper .eyebrow {
          display: inline-flex;
          align-items: center;
          gap: 9px;
          font-weight: 600;
          font-size: 14.5px;
          letter-spacing: 2px;
          text-transform: uppercase;
          color: #33493c;
          background: rgba(255,255,255,0.55);
          border: 1px solid rgba(255,255,255,0.8);
          padding: 9px 20px;
          border-radius: 999px;
        }
        .agriseva-landing-wrapper .eyebrow .pulse {
          width: 8px; height: 8px; border-radius: 50%;
          background: var(--green);
        }

        .agriseva-landing-wrapper .headline {
          margin: 28px auto 0;
          max-width: 1020px;
          font-family: 'Poppins', sans-serif;
          font-weight: 800;
          font-size: 70px;
          line-height: 1.08;
          letter-spacing: -2px;
        }
        .agriseva-landing-wrapper .headline .l1 {
          background: linear-gradient(120deg, #2a3b32 0%, #14201a 70%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .agriseva-landing-wrapper .headline .l2 {
          background: linear-gradient(120deg, #28c98a 0%, #137a4c 85%);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }

        .agriseva-landing-wrapper .subtitle {
          margin: 24px auto 0;
          max-width: 680px;
          font-size: 19px;
          line-height: 1.55;
          color: #2c4338;
          font-weight: 500;
        }

        .agriseva-landing-wrapper .cta-row {
          margin-top: 34px;
          display: flex;
          gap: 16px;
          justify-content: center;
        }
        .agriseva-landing-wrapper .btn-primary {
          background: var(--ink);
          color: #fff;
          border: none;
          padding: 17px 36px;
          border-radius: 14px;
          font-weight: 600;
          font-size: 17px;
          cursor: pointer;
          box-shadow: 0 14px 30px rgba(20,40,28,0.3);
          transition: transform .2s, box-shadow .2s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
        }
        .agriseva-landing-wrapper .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 18px 36px rgba(20,40,28,0.38); }
        .agriseva-landing-wrapper .btn-ghost {
          background: rgba(255,255,255,0.7);
          color: var(--ink);
          border: 1px solid rgba(255,255,255,0.9);
          padding: 17px 32px;
          border-radius: 14px;
          font-weight: 600;
          font-size: 17px;
          cursor: pointer;
          backdrop-filter: blur(6px);
          transition: background .2s, transform .2s;
          text-decoration: none;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .agriseva-landing-wrapper .btn-ghost:hover { background: rgba(255,255,255,0.92); transform: translateY(-2px); }

        .agriseva-landing-wrapper .stats {
          margin-top: 54px;
          display: flex;
          justify-content: center;
          gap: 72px;
          color: #fff;
        }
        .agriseva-landing-wrapper .stat .num {
          font-family: 'Poppins', sans-serif;
          font-weight: 800;
          font-size: 42px;
          line-height: 1;
        }
        .agriseva-landing-wrapper .stat .lbl {
          margin-top: 7px;
          font-size: 14px;
          font-weight: 600;
          letter-spacing: 0.6px;
          text-transform: uppercase;
          color: rgba(255,255,255,0.85);
        }

        /* ---------- PRODUCTS (SOLUTIONS & SIMULATION) ---------- */
        .agriseva-landing-wrapper .products {
          max-width: 1200px;
          margin: 0 auto;
          padding: 100px 64px 0;
        }
        .agriseva-landing-wrapper .sec-head {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 44px;
        }
        .agriseva-landing-wrapper .sec-head h2 {
          font-family: 'Poppins', sans-serif;
          font-weight: 700;
          font-size: 46px;
          letter-spacing: -1.5px;
          line-height: 1.05;
        }
        .agriseva-landing-wrapper .sec-head .faded { color: var(--grey-faint); }
        .agriseva-landing-wrapper .sec-head p {
          max-width: 360px;
          color: #5b6e64;
          font-size: 16px;
          line-height: 1.5;
          font-weight: 500;
        }

        .agriseva-landing-wrapper .grid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 28px;
        }
        .agriseva-landing-wrapper .card {
          background: #fff;
          border-radius: 22px;
          overflow: hidden;
          border: 1px solid #e7ece8;
          box-shadow: 0 18px 40px rgba(30,60,45,0.07);
          transition: transform .25s, box-shadow .25s;
        }
        .agriseva-landing-wrapper .card:hover { transform: translateY(-6px); box-shadow: 0 26px 54px rgba(30,60,45,0.13); }
        .agriseva-landing-wrapper .card .imgwrap {
          position: relative;
          aspect-ratio: 1 / 1;
          background: #eef3ef;
          overflow: hidden;
        }
        .agriseva-landing-wrapper .card .imgwrap img {
          width: 100%; height: 100%;
          object-fit: cover;
          display: block;
          transition: transform .4s;
        }
        .agriseva-landing-wrapper .card:hover .imgwrap img {
          transform: scale(1.04);
        }
        .agriseva-landing-wrapper .card .tag {
          position: absolute;
          top: 16px; left: 16px;
          background: rgba(255,255,255,0.92);
          color: var(--green-deep);
          font-weight: 700;
          font-size: 12px;
          letter-spacing: 0.8px;
          text-transform: uppercase;
          padding: 7px 13px;
          border-radius: 999px;
          backdrop-filter: blur(4px);
        }
        .agriseva-landing-wrapper .card .body {
          padding: 22px 22px 24px;
        }
        .agriseva-landing-wrapper .card .row {
          display: flex;
          align-items: baseline;
          justify-content: space-between;
        }
        .agriseva-landing-wrapper .card .name {
          font-family: 'Poppins', sans-serif;
          font-weight: 600;
          font-size: 21px;
          letter-spacing: -0.3px;
        }
        .agriseva-landing-wrapper .card .price {
          font-weight: 700;
          font-size: 18px;
          color: var(--green-deep);
        }
        .agriseva-landing-wrapper .card .desc {
          margin-top: 8px;
          color: #6a7d72;
          font-size: 15px;
          line-height: 1.5;
        }
        .agriseva-landing-wrapper .card .add {
          margin-top: 18px;
          width: 100%;
          background: var(--paper);
          border: 1px solid #e2e8e4;
          color: var(--ink);
          padding: 13px;
          border-radius: 12px;
          font-weight: 600;
          font-size: 15px;
          cursor: pointer;
          transition: background .2s, color .2s;
        }
        .agriseva-landing-wrapper .card .add:hover { background: var(--ink); color: #fff; }

        /* ---------- VALUES (UNCERTAINTY FACTORS) ---------- */
        .agriseva-landing-wrapper .values {
          max-width: 1200px;
          margin: 0 auto;
          padding: 110px 64px 0;
        }
        .agriseva-landing-wrapper .values-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 24px;
        }
        .agriseva-landing-wrapper .value {
          background: #fff;
          border: 1px solid #e7ece8;
          border-radius: 20px;
          padding: 32px 26px;
          box-shadow: 0 14px 34px rgba(30,60,45,0.06);
          transition: transform .25s;
        }
        .agriseva-landing-wrapper .value:hover { transform: translateY(-5px); }
        .agriseva-landing-wrapper .value .vicon {
          width: 54px; height: 54px;
          border-radius: 15px;
          background: linear-gradient(135deg, var(--green-light), var(--green-deep));
          display: grid; place-items: center;
          margin-bottom: 22px;
        }
        .agriseva-landing-wrapper .value h4 {
          font-family: 'Poppins', sans-serif;
          font-weight: 600;
          font-size: 19px;
          letter-spacing: -0.3px;
          margin-bottom: 9px;
        }
        .agriseva-landing-wrapper .value p {
          color: #6a7d72;
          font-size: 14.5px;
          line-height: 1.55;
          font-weight: 500;
        }

        /* ---------- CATEGORIES (HOW IT WORKS) ---------- */
        .agriseva-landing-wrapper .categories {
          max-width: 1200px;
          margin: 0 auto;
          padding: 110px 64px 0;
        }
        .agriseva-landing-wrapper .cat-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 22px;
        }
        .agriseva-landing-wrapper .cat {
          position: relative;
          aspect-ratio: 3 / 4;
          border-radius: 22px;
          overflow: hidden;
          cursor: pointer;
          border: 1px solid #e7ece8;
        }
        .agriseva-landing-wrapper .cat img {
          width: 100%; height: 100%;
          object-fit: cover; display: block;
          transition: transform .45s;
        }
        .agriseva-landing-wrapper .cat:hover img { transform: scale(1.06); }
        .agriseva-landing-wrapper .cat .ov {
          position: absolute; inset: 0;
          background: linear-gradient(to top, rgba(16,36,28,0.85), rgba(16,36,28,0.1) 60%);
          display: flex; flex-direction: column; justify-content: flex-end;
          padding: 24px;
        }
        .agriseva-landing-wrapper .cat .ov .cname {
          color: #fff;
          font-family: 'Poppins', sans-serif;
          font-weight: 600;
          font-size: 21px;
          letter-spacing: -0.3px;
        }
        .agriseva-landing-wrapper .cat .ov .ccount {
          color: rgba(255,255,255,0.78);
          font-size: 13px;
          font-weight: 600;
          margin-top: 4px;
        }

        /* ---------- IMPACT ---------- */
        .agriseva-landing-wrapper .impact {
          max-width: 1200px;
          margin: 110px auto 0;
          padding: 0 64px;
        }
        .agriseva-landing-wrapper .impact-inner {
          background:
            radial-gradient(ellipse 60% 80% at 85% 20%, rgba(111,217,154,0.5), transparent 70%),
            radial-gradient(ellipse 60% 80% at 10% 90%, rgba(24,179,163,0.55), transparent 70%),
            linear-gradient(135deg, #137a4c, #1f9d63);
          border-radius: 30px;
          padding: 70px 64px;
          color: #fff;
          text-align: center;
        }
        .agriseva-landing-wrapper .impact-inner .ieyebrow {
          font-weight: 600; font-size: 14px; letter-spacing: 2px;
          text-transform: uppercase; color: rgba(255,255,255,0.8);
        }
        .agriseva-landing-wrapper .impact-inner h2 {
          font-family: 'Poppins', sans-serif;
          font-weight: 700;
          font-size: 42px;
          letter-spacing: -1px;
          margin: 14px auto 0;
          max-width: 680px;
          line-height: 1.1;
        }
        .agriseva-landing-wrapper .impact-stats {
          margin-top: 50px;
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 30px;
        }
        .agriseva-landing-wrapper .istat .inum {
          font-family: 'Poppins', sans-serif;
          font-weight: 800;
          font-size: 44px;
          line-height: 1;
        }
        .agriseva-landing-wrapper .istat .ilbl {
          margin-top: 10px;
          font-size: 14px;
          font-weight: 500;
          color: rgba(255,255,255,0.82);
          line-height: 1.4;
        }

        /* ---------- TESTIMONIALS ---------- */
        .agriseva-landing-wrapper .testimonials {
          max-width: 1200px;
          margin: 0 auto;
          padding: 110px 64px 0;
        }
        .agriseva-landing-wrapper .tgrid {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 26px;
        }
        .agriseva-landing-wrapper .tcard {
          background: #fff;
          border: 1px solid #e7ece8;
          border-radius: 22px;
          padding: 32px 30px;
          box-shadow: 0 16px 38px rgba(30,60,45,0.06);
        }
        .agriseva-landing-wrapper .tcard .stars { color: #1f9d63; font-size: 17px; letter-spacing: 2px; }
        .agriseva-landing-wrapper .tcard .quote {
          margin-top: 18px;
          font-size: 16px;
          line-height: 1.6;
          color: #2c4338;
          font-weight: 500;
        }
        .agriseva-landing-wrapper .tcard .who {
          margin-top: 26px;
          display: flex; align-items: center; gap: 13px;
        }
        .agriseva-landing-wrapper .tcard .avatar {
          width: 46px; height: 46px; border-radius: 50%;
          object-fit: cover;
        }
        .agriseva-landing-wrapper .tcard .who .nm { font-weight: 700; font-size: 15px; }
        .agriseva-landing-wrapper .tcard .who .rl { font-size: 13px; color: #6a7d72; font-weight: 500; }

        /* ---------- FAQ ---------- */
        .agriseva-landing-wrapper .faq {
          max-width: 1200px;
          margin: 0 auto;
          padding: 110px 64px 0;
        }
        .agriseva-landing-wrapper .faq-wrap {
          display: grid;
          grid-template-columns: 0.85fr 1.15fr;
          gap: 60px;
          align-items: start;
        }
        .agriseva-landing-wrapper .faq-wrap .sec-head { display: block; margin-bottom: 0; }
        .agriseva-landing-wrapper .faq-list {
          display: flex; flex-direction: column; gap: 14px;
        }
        .agriseva-landing-wrapper .faq-item {
          background: #fff;
          border: 1px solid #e7ece8;
          border-radius: 16px;
          padding: 24px 26px;
          cursor: pointer;
          transition: border-color .2s;
        }
        .agriseva-landing-wrapper .faq-item:hover { border-color: var(--green-light); }
        .agriseva-landing-wrapper .faq-item .q {
          display: flex; align-items: center; justify-content: space-between;
          font-family: 'Poppins', sans-serif;
          font-weight: 600; font-size: 18px;
          letter-spacing: -0.2px;
          gap: 16px;
        }
        .agriseva-landing-wrapper .faq-item .q .pm {
          width: 24px; height: 24px; flex-shrink: 0;
          color: var(--green-deep);
          transition: transform .2s;
        }
        .agriseva-landing-wrapper .faq-item .a {
          margin-top: 12px;
          color: #6a7d72;
          font-size: 15px;
          line-height: 1.6;
          font-weight: 500;
        }

        /* ---------- FOOTER ---------- */
        .agriseva-landing-wrapper .footer {
          margin-top: 100px;
          background: var(--ink);
          color: #fff;
        }
        .agriseva-landing-wrapper .footer-inner {
          max-width: 1200px;
          margin: 0 auto;
          padding: 70px 64px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 30px;
        }
        .agriseva-landing-wrapper .footer h3 {
          font-family: 'Poppins', sans-serif;
          font-weight: 700;
          font-size: 40px;
          letter-spacing: -1px;
          line-height: 1.05;
          max-width: 540px;
        }
        .agriseva-landing-wrapper .footer h3 span {
          background: linear-gradient(120deg, #6fd99a, #18b3a3);
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
        }
        .agriseva-landing-wrapper .signup {
          display: flex;
          gap: 12px;
        }
        .agriseva-landing-wrapper .signup input {
          background: rgba(255,255,255,0.08);
          border: 1px solid rgba(255,255,255,0.18);
          color: #fff;
          padding: 16px 20px;
          border-radius: 12px;
          font-size: 16px;
          width: 260px;
          outline: none;
        }
        .agriseva-landing-wrapper .signup input::placeholder { color: rgba(255,255,255,0.5); }
        .agriseva-landing-wrapper .signup button {
          background: linear-gradient(135deg, var(--green-light), var(--green-deep));
          color: var(--ink);
          border: none;
          padding: 16px 28px;
          border-radius: 12px;
          font-weight: 700;
          font-size: 16px;
          cursor: pointer;
          transition: opacity .2s;
        }
        .agriseva-landing-wrapper .signup button:hover { opacity: 0.92; }
        .agriseva-landing-wrapper .footnote {
          max-width: 1200px;
          margin: 0 auto;
          padding: 0 64px 50px;
          color: rgba(255,255,255,0.55);
          font-size: 14px;
          font-weight: 500;
          letter-spacing: 0.5px;
          display: flex;
          justify-content: space-between;
          border-top: 1px solid rgba(255,255,255,0.1);
          padding-top: 28px;
        }

        /* ---------- INTERACTIVE SIMULATOR MODAL ---------- */
        .agriseva-landing-wrapper .modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(16, 28, 22, 0.75);
          backdrop-filter: blur(8px);
          z-index: 1000;
          display: none;
          place-items: center;
          padding: 20px;
          opacity: 0;
          transition: opacity .25s ease;
        }
        .agriseva-landing-wrapper .modal-overlay.active {
          display: grid;
          opacity: 1;
        }
        .agriseva-landing-wrapper .demo-modal {
          background: #fff;
          border-radius: 24px;
          max-width: 820px;
          width: 100%;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 30px 70px rgba(0,0,0,0.35);
          border: 1px solid #e2ece5;
          animation: modalIn .3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes modalIn {
          from { transform: scale(0.94) translateY(12px); opacity: 0; }
          to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .agriseva-landing-wrapper .demo-header {
          padding: 24px 32px;
          background: linear-gradient(135deg, #137a4c, #1f9d63);
          color: #fff;
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-radius: 24px 24px 0 0;
        }
        .agriseva-landing-wrapper .demo-header h3 {
          font-family: 'Poppins', sans-serif;
          font-size: 22px;
          font-weight: 700;
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .agriseva-landing-wrapper .demo-close-btn {
          background: rgba(255,255,255,0.2);
          border: none;
          color: #fff;
          width: 36px;
          height: 36px;
          border-radius: 50%;
          font-size: 18px;
          cursor: pointer;
          display: grid;
          place-items: center;
          transition: background .2s;
        }
        .agriseva-landing-wrapper .demo-close-btn:hover { background: rgba(255,255,255,0.35); }
        .agriseva-landing-wrapper .demo-body {
          padding: 30px 32px;
        }
        .agriseva-landing-wrapper .sim-grid {
          display: grid;
          grid-template-columns: 1fr 1.15fr;
          gap: 28px;
        }
        .agriseva-landing-wrapper .sim-controls h4, .agriseva-landing-wrapper .sim-results h4 {
          font-family: 'Poppins', sans-serif;
          font-size: 16px;
          font-weight: 700;
          margin-bottom: 18px;
          color: var(--ink);
        }
        .agriseva-landing-wrapper .sim-control-group {
          margin-bottom: 18px;
        }
        .agriseva-landing-wrapper .sim-label-row {
          display: flex;
          justify-content: space-between;
          font-size: 14px;
          font-weight: 600;
          margin-bottom: 6px;
          color: #33493c;
        }
        .agriseva-landing-wrapper .sim-val {
          color: var(--green-deep);
          font-weight: 700;
        }
        .agriseva-landing-wrapper .sim-slider {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: #e1e8e4;
          outline: none;
          accent-color: var(--green);
          cursor: pointer;
        }
        .agriseva-landing-wrapper .sim-results {
          background: var(--paper);
          border-radius: 18px;
          padding: 22px;
          border: 1px solid #e2ece5;
        }
        .agriseva-landing-wrapper .metric-cards {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px;
          margin-bottom: 18px;
        }
        .agriseva-landing-wrapper .metric-card {
          background: #fff;
          padding: 14px;
          border-radius: 12px;
          border: 1px solid #e7eee9;
        }
        .agriseva-landing-wrapper .metric-card .m-lbl {
          font-size: 12px;
          font-weight: 600;
          color: #6a7d72;
          text-transform: uppercase;
        }
        .agriseva-landing-wrapper .metric-card .m-val {
          font-family: 'Poppins', sans-serif;
          font-size: 20px;
          font-weight: 800;
          color: var(--ink);
          margin-top: 4px;
        }
        .agriseva-landing-wrapper .metric-card .m-val.green { color: var(--green-deep); }
        .agriseva-landing-wrapper .metric-card .m-val.risk-badge {
          font-size: 14px;
          display: inline-block;
          padding: 3px 8px;
          border-radius: 6px;
          background: #eafaf1;
          color: var(--green-deep);
        }
        .agriseva-landing-wrapper .explain-box {
          background: #fff;
          border-radius: 12px;
          padding: 14px;
          border: 1px solid #e7eee9;
          font-size: 13.5px;
          line-height: 1.5;
          color: #2c4338;
        }
        .agriseva-landing-wrapper .explain-box strong {
          color: var(--green-deep);
          display: block;
          margin-bottom: 4px;
        }

        /* ---------- RESPONSIVE ---------- */
        @media (max-width: 1024px) {
          .agriseva-landing-wrapper .nav { padding: 32px 40px 0; }
          .agriseva-landing-wrapper .hero-inner { padding: 48px 40px 0; }
          .agriseva-landing-wrapper .headline { font-size: 54px; letter-spacing: -1.5px; line-height: 1.12; }
          .agriseva-landing-wrapper .products,
          .agriseva-landing-wrapper .values,
          .agriseva-landing-wrapper .categories,
          .agriseva-landing-wrapper .testimonials,
          .agriseva-landing-wrapper .faq { padding-left: 40px; padding-right: 40px; }
          .agriseva-landing-wrapper .impact { padding-left: 40px; padding-right: 40px; }

          .agriseva-landing-wrapper .grid { grid-template-columns: repeat(2, 1fr); }
          .agriseva-landing-wrapper .values-grid { grid-template-columns: repeat(2, 1fr); }
          .agriseva-landing-wrapper .cat-grid { grid-template-columns: repeat(2, 1fr); }
          .agriseva-landing-wrapper .tgrid { grid-template-columns: repeat(2, 1fr); }
          .agriseva-landing-wrapper .impact-stats { grid-template-columns: repeat(2, 1fr); gap: 38px 30px; }

          .agriseva-landing-wrapper .stats { gap: 48px; }

          .agriseva-landing-wrapper .faq-wrap { grid-template-columns: 1fr; gap: 36px; }
          .agriseva-landing-wrapper .sim-grid { grid-template-columns: 1fr; }
        }

        @media (max-width: 680px) {
          .agriseva-landing-wrapper .nav {
            flex-wrap: wrap;
            gap: 18px;
            padding: 26px 22px 0;
          }
          .agriseva-landing-wrapper .navlinks { order: 3; width: 100%; justify-content: center; gap: 24px; font-size: 15px; }
          .agriseva-landing-wrapper .brand { font-size: 24px; }
          .agriseva-landing-wrapper .cart { padding: 11px 18px; font-size: 14px; }

          .agriseva-landing-wrapper .hero { min-height: 0; padding-bottom: 70px; }
          .agriseva-landing-wrapper .hero-inner { padding: 36px 22px 0; }
          .agriseva-landing-wrapper .headline { font-size: 38px; letter-spacing: -1px; line-height: 1.16; margin-top: 22px; }
          .agriseva-landing-wrapper .subtitle { font-size: 16.5px; margin-top: 18px; }
          .agriseva-landing-wrapper .eyebrow { font-size: 12px; letter-spacing: 1.2px; text-align: left; }

          .agriseva-landing-wrapper .cta-row { flex-direction: column; align-items: center; gap: 12px; }
          .agriseva-landing-wrapper .cta-row button, .agriseva-landing-wrapper .cta-row a { width: 100%; max-width: 320px; text-align: center; }

          .agriseva-landing-wrapper .stats {
            margin-top: 42px;
            flex-wrap: wrap;
            gap: 28px 40px;
          }
          .agriseva-landing-wrapper .stat .num { font-size: 34px; }

          .agriseva-landing-wrapper .products,
          .agriseva-landing-wrapper .values,
          .agriseva-landing-wrapper .categories,
          .agriseva-landing-wrapper .testimonials,
          .agriseva-landing-wrapper .faq {
            padding-left: 22px;
            padding-right: 22px;
            padding-top: 70px;
          }
          .agriseva-landing-wrapper .impact {
            margin-top: 70px;
            padding-left: 22px;
            padding-right: 22px;
          }
          .agriseva-landing-wrapper .impact-inner { padding: 48px 26px; }
          .agriseva-landing-wrapper .impact-inner h2 { font-size: 30px; }

          .agriseva-landing-wrapper .sec-head {
            flex-direction: column;
            align-items: flex-start;
            gap: 16px;
          }
          .agriseva-landing-wrapper .sec-head h2 { font-size: 36px; }
          .agriseva-landing-wrapper .sec-head p { max-width: none; }

          .agriseva-landing-wrapper .grid { grid-template-columns: 1fr; gap: 22px; }
          .agriseva-landing-wrapper .values-grid { grid-template-columns: 1fr; gap: 18px; }
          .agriseva-landing-wrapper .cat-grid { grid-template-columns: repeat(2, 1fr); gap: 16px; }
          .agriseva-landing-wrapper .tgrid { grid-template-columns: 1fr; gap: 20px; }
          .agriseva-landing-wrapper .impact-stats { grid-template-columns: 1fr; gap: 32px; }
          .agriseva-landing-wrapper .istat .inum { font-size: 40px; }

          .agriseva-landing-wrapper .footer-inner {
            flex-direction: column;
            align-items: flex-start;
            padding: 50px 22px;
          }
          .agriseva-landing-wrapper .footer h3 { font-size: 30px; }
          .agriseva-landing-wrapper .signup { width: 100%; }
          .agriseva-landing-wrapper .signup input { width: 100%; flex: 1; }
          .agriseva-landing-wrapper .footnote {
            flex-direction: column;
            gap: 10px;
            padding: 28px 22px 40px;
          }
          .agriseva-landing-wrapper .demo-body { padding: 20px 18px; }
          .agriseva-landing-wrapper .demo-header { padding: 18px 20px; }
        }
      `}</style>

      <div className="page">
        {/* HERO */}
        <section className="hero" id="home">
          <div className="dots"></div>

          <nav className="nav">
            <a href="#home" className="brand">
              <img
                className="brand-logo-img"
                src="/favicon.svg"
                alt="AgriSeva-AI logo"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/logo.png";
                }}
              />
              <span>AgriSeva-AI</span>
            </a>
            <div className="navlinks">
              <a href="#how-it-works">How It Works</a>
              <a href="#features">Features</a>
              <a href="#simulation">Simulation</a>
              <a href="#impact">Impact</a>
            </div>
            <button
              onClick={() => navigate({ to: user ? "/home" : "/auth" })}
              className="cart cursor-pointer"
              id="nav-demo-btn"
              aria-label={user ? "Go to Dashboard" : "Get Started"}
            >
              {user ? "Dashboard →" : "Get Started →"}
            </button>
          </nav>

          <div className="hero-inner">
            <span className="eyebrow">
              <span className="pulse"></span>AI-POWERED AGRICULTURAL INTELLIGENCE
            </span>

            <h1 className="headline">
              <span className="l1">Every Farmer a King,</span>
              <br />
              <span className="l2">with AI by their side.</span>
            </h1>

            <p className="subtitle">
              AgriSeva-AI is an intelligent agricultural advisory platform providing AI guidance, multilingual voice assistance, live weather, soil insights, India-wide mandi market prices, chemical safety verification, and verified expert support.
            </p>

            <div className="cta-row">
              <button
                onClick={() => navigate({ to: user ? "/home" : "/auth" })}
                className="btn-primary cursor-pointer"
                id="hero-demo-btn"
                aria-label="Get Started with AgriSeva-AI"
              >
                {user ? "Go to Dashboard →" : "Get Started with AgriSeva-AI →"}
              </button>
              <button
                className="btn-ghost"
                onClick={() => {
                  const el = document.getElementById("how-it-works");
                  if (el) el.scrollIntoView({ behavior: "smooth" });
                }}
              >
                Explore How It Works
              </button>
            </div>

            <div className="stats">
              <div className="stat">
                <div className="num">24/7</div>
                <div className="lbl">AI ADVISORY</div>
              </div>
              <div className="stat">
                <div className="num">VOICE</div>
                <div className="lbl">MULTILINGUAL AI</div>
              </div>
              <div className="stat">
                <div className="num">ALL-INDIA</div>
                <div className="lbl">MANDI PRICES</div>
              </div>
            </div>
          </div>
        </section>

        {/* PRODUCTS / AGRICULTURAL INTELLIGENCE CAPABILITIES */}
        <section className="products" id="simulation">
          <div className="sec-head">
            <h2>
              Agricultural Advisory
              <br />
              <span className="faded">&amp; Farm Intelligence</span>
            </h2>
            <p>
              Access AI-powered crop guidance, India-wide mandi market prices, and expert assistance tailored to your farming needs.
            </p>
          </div>

          <div className="grid">
            <article className="card">
              <div className="imgwrap">
                <span className="tag">AI Advisory</span>
                <img
                  src="https://images.unsplash.com/photo-1500937386664-56d1dfef3854?auto=format&fit=crop&w=800&q=80"
                  alt="AI-powered crop guidance in golden wheat field"
                />
              </div>
              <div className="body">
                <div className="row">
                  <span className="name">AI Crop Advisory</span>
                  <span className="price">Smart Guidance</span>
                </div>
                <p className="desc">
                  Get AI-powered guidance for crop care, farming decisions, and agricultural questions across all stages of cultivation.
                </p>
                <button className="add cursor-pointer" onClick={() => (window as any).openDemoModal()}>
                  Simulate Crop Scenarios
                </button>
              </div>
            </article>

            <article className="card">
              <div className="imgwrap">
                <span className="tag">Market Discovery</span>
                <img
                  src="https://images.unsplash.com/photo-1625246333195-78d9c38ad449?auto=format&fit=crop&w=800&q=80"
                  alt="Market price discovery across agricultural mandis"
                />
              </div>
              <div className="body">
                <div className="row">
                  <span className="name">Market Price Discovery</span>
                  <span className="price">Mandi Information</span>
                </div>
                <p className="desc">
                  Find India-wide crop market-price information across agricultural markets to discover current fair market value.
                </p>
                <button className="add cursor-pointer" onClick={() => (window as any).openDemoModal()}>
                  Explore Market Values
                </button>
              </div>
            </article>

            <article className="card">
              <div className="imgwrap">
                <span className="tag">Safety &amp; Experts</span>
                <img
                  src="https://images.unsplash.com/photo-1586771107445-d3ca888129ff?auto=format&fit=crop&w=800&q=80"
                  alt="Chemical verification and expert assistance"
                />
              </div>
              <div className="body">
                <div className="row">
                  <span className="name">Chemical Safety &amp; Experts</span>
                  <span className="price">Verified Care</span>
                </div>
                <p className="desc">
                  Verify agricultural chemicals before use and escalate complex farming questions to verified agricultural experts.
                </p>
                <button className="add cursor-pointer" onClick={() => (window as any).openDemoModal()}>
                  Explore Safety &amp; Experts
                </button>
              </div>
            </article>
          </div>
        </section>

        {/* VALUES / COMPREHENSIVE FARMING INTELLIGENCE */}
        <section className="values" id="features">
          <div className="sec-head">
            <h2>
              Farming Intelligence
              <br />
              <span className="faded">Every Step of the Season</span>
            </h2>
            <p>
              AgriSeva-AI brings useful agricultural intelligence closer to farmers to support better day-to-day decisions.
            </p>
          </div>
          <div className="values-grid">
            <div className="value">
              <div className="vicon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 16.58A5 5 0 0 0 18 7h-1.26A8 8 0 1 0 4 15.25" />
                  <path d="M8 19v2M8 13v2M12 21v2M12 15v2M16 19v2M16 13v2" />
                </svg>
              </div>
              <h4>Weather Intelligence</h4>
              <p>Use weather information to make better day-to-day farming decisions and plan field operations effectively.</p>
            </div>
            <div className="value">
              <div className="vicon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" />
                </svg>
              </div>
              <h4>Soil Information</h4>
              <p>Understand soil-related information to support better crop choices, nutrient application, and irrigation planning.</p>
            </div>
            <div className="value">
              <div className="vicon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <line x1="12" y1="1" x2="12" y2="23" />
                  <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                </svg>
              </div>
              <h4>Agricultural Safety</h4>
              <p>Verify agricultural chemicals and receive safety-focused guidance before applying treatments on your crops.</p>
            </div>
            <div className="value">
              <div className="vicon">
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="#fff"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <polyline points="23 6 13.5 15.5 8.5 10.5 1 18" />
                  <polyline points="17 6 23 6 23 12" />
                </svg>
              </div>
              <h4>Market Price Discovery</h4>
              <p>Find India-wide crop market-price information across agricultural markets to discover current fair market value.</p>
            </div>
          </div>
        </section>

        {/* CATEGORIES / HOW IT WORKS PROCESS */}
        <section className="categories" id="how-it-works">
          <div className="sec-head">
            <h2>
              How It Works
              <br />
              <span className="faded">From Question to Guidance</span>
            </h2>
            <p>A simple, farmer-friendly workflow bringing trustworthy agricultural intelligence straight to your hands.</p>
          </div>
          <div className="cat-grid">
            <div className="cat" onClick={() => (window as any).openDemoModal()}>
              <img
                src="https://images.unsplash.com/photo-1592982537447-7440770cbfc9?auto=format&fit=crop&w=800&q=80"
                alt="Ask questions in any language"
              />
              <div className="ov">
                <div className="cname">01. Ask in Any Language</div>
                <div className="ccount">Multilingual Text &amp; Voice Assistance</div>
              </div>
            </div>
            <div className="cat" onClick={() => (window as any).openDemoModal()}>
              <img
                src="https://images.unsplash.com/photo-1530507629858-e4977d30e9e0?auto=format&fit=crop&w=800&q=80"
                alt="Context-aware farming intelligence"
              />
              <div className="ov">
                <div className="cname">02. Context-Aware AI</div>
                <div className="ccount">Weather, Soil &amp; Mandi Information</div>
              </div>
            </div>
            <div className="cat" onClick={() => (window as any).openDemoModal()}>
              <img
                src="https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?auto=format&fit=crop&w=800&q=80"
                alt="Verified agricultural guidance"
              />
              <div className="ov">
                <div className="cname">03. Verified Advisory</div>
                <div className="ccount">Package of Practices &amp; Safety Checks</div>
              </div>
            </div>
            <div className="cat" onClick={() => (window as any).openDemoModal()}>
              <img
                src="https://images.unsplash.com/photo-1574943320219-553eb213f72d?auto=format&fit=crop&w=800&q=80"
                alt="Expert assistance and escalation"
              />
              <div className="ov">
                <div className="cname">04. Expert Support</div>
                <div className="ccount">Escalate to Agricultural Specialists</div>
              </div>
            </div>
          </div>
        </section>

        {/* IMPACT */}
        <section className="impact" id="impact">
          <div className="impact-inner">
            <div className="ieyebrow">Agricultural Decision Support</div>
            <h2>Empowering Every Farmer with Timely, Trustworthy Intelligence.</h2>
            <div className="impact-stats">
              <div className="istat">
                <div className="inum">AI Advisory</div>
                <div className="ilbl">
                  Crop Guidance
                  <br />
                  Answers for day-to-day farming questions
                </div>
              </div>
              <div className="istat">
                <div className="inum">Multilingual</div>
                <div className="ilbl">
                  Voice Support
                  <br />
                  Interact naturally in regional languages
                </div>
              </div>
              <div className="istat">
                <div className="inum">Mandi Prices</div>
                <div className="ilbl">
                  Price Discovery
                  <br />
                  Current market rates across India
                </div>
              </div>
              <div className="istat">
                <div className="inum">Expert Care</div>
                <div className="ilbl">
                  Specialist Review
                  <br />
                  Escalate complex questions to experts
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* TESTIMONIALS */}
        <section className="testimonials">
          <div className="sec-head">
            <h2>
              Farmer &amp; Expert
              <br />
              <span className="faded">Experiences</span>
            </h2>
            <p>How AgriSeva-AI assists farmers, extension workers, and coordinators across agricultural regions.</p>
          </div>
          <div className="tgrid">
            <div className="tcard">
              <div className="stars">★★★★★</div>
              <p className="quote">
                "AgriSeva-AI makes agricultural advice instantly accessible in our local language. The voice assistance helps us get crop guidance without typing."
              </p>
              <div className="who">
                <img
                  className="avatar"
                  src="https://v3b.fal.media/files/b/0a9d0453/eDhCItXOpFl69JUcKwpl1_iHWVb0x9.png"
                  alt="Ramesh Patel"
                />
                <div>
                  <div className="nm">Ramesh Patel</div>
                  <div className="rl">Paddy &amp; Wheat Farmer</div>
                </div>
              </div>
            </div>
            <div className="tcard">
              <div className="stars">★★★★★</div>
              <p className="quote">
                "Checking mandi prices across nearby markets before selling helps us understand fair market value for our harvest with complete confidence."
              </p>
              <div className="who">
                <img
                  className="avatar"
                  src="https://v3b.fal.media/files/b/0a9d0453/O9eTApglht4osQUa-neJD_7xTvOCXF.png"
                  alt="Suresh Kumar"
                />
                <div>
                  <div className="nm">Suresh Kumar</div>
                  <div className="rl">Cotton &amp; Soybean Grower</div>
                </div>
              </div>
            </div>
            <div className="tcard">
              <div className="stars">★★★★★</div>
              <p className="quote">
                "Having verified Package of Practices and expert escalation ensures farmers receive accurate, safety-verified chemical guidance."
              </p>
              <div className="who">
                <img
                  className="avatar"
                  src="https://v3b.fal.media/files/b/0a9d0453/SCmfGHR_nLu7wtB7bnzA8_XDfmDl9T.png"
                  alt="Dr. Ananya Sharma"
                />
                <div>
                  <div className="nm">Dr. Ananya Sharma</div>
                  <div className="rl">Agricultural Extension Specialist</div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="faq" id="faq">
          <div className="faq-wrap">
            <div className="sec-head">
              <h2>
                Frequently
                <br />
                <span className="faded">Asked Questions</span>
              </h2>
              <p>Everything you need to know about agricultural guidance, market prices, and expert support on AgriSeva-AI.</p>
            </div>
            <div className="faq-list">
              <div className="faq-item" onClick={(e) => (window as any).toggleFaq(e.currentTarget)}>
                <div className="q">
                  What is AgriSeva-AI and how does it help farmers?
                  <svg className="pm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <div className="a" style={{ display: "none" }}>
                  AgriSeva-AI is an AI-powered agricultural decision-support platform that helps farmers make better decisions using AI-driven crop guidance, multilingual voice assistance, weather and soil information, and expert support.
                </div>
              </div>
              <div className="faq-item" onClick={(e) => (window as any).toggleFaq(e.currentTarget)}>
                <div className="q">
                  Can farmers interact using voice and regional languages?
                  <svg className="pm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <div className="a" style={{ display: "none" }}>
                  Yes. Farmers can speak or type in multiple Indian languages, making agricultural intelligence easily accessible directly through conversational voice and text assistance.
                </div>
              </div>
              <div className="faq-item" onClick={(e) => (window as any).toggleFaq(e.currentTarget)}>
                <div className="q">
                  How does AgriSeva-AI provide market-price information?
                  <svg className="pm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <div className="a" style={{ display: "none" }}>
                  AgriSeva-AI provides current crop market prices across Indian mandis and Agmarknet, helping farmers discover market values and compare nearby market rates at harvest.
                </div>
              </div>
              <div className="faq-item" onClick={(e) => (window as any).toggleFaq(e.currentTarget)}>
                <div className="q">
                  Can complex agricultural questions be escalated to experts?
                  <svg className="pm" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <path d="M12 5v14M5 12h14" />
                  </svg>
                </div>
                <div className="a" style={{ display: "none" }}>
                  Yes. Whenever a farming query requires human validation, AgriSeva-AI escalates the question to verified agricultural experts and Package of Practices coordinators for authoritative review.
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* FOOTER */}
        <footer className="footer">
          <div className="footer-inner">
            <h3>
              Ready to farm with <span>AI by your side?</span>
            </h3>
            <div className="signup">
              <input type="email" placeholder="Enter your email" aria-label="Email address" />
              <button
                onClick={() => navigate({ to: user ? "/home" : "/auth" })}
                className="btn-primary cursor-pointer"
                style={{
                  padding: "14px 28px",
                  borderRadius: "999px",
                  background: "var(--green-deep)",
                  color: "#fff",
                  fontWeight: 600,
                  fontSize: "15px",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  border: "none",
                }}
              >
                Get Started →
              </button>
            </div>
          </div>
          <div className="footnote">
            <span>© 2026 AgriSeva-AI — Agricultural Decision Support Platform. All rights reserved.</span>
            <span>Every Farmer a King, with AI by their side.</span>
          </div>
        </footer>
      </div>

      {/* INTERACTIVE LIVE DEMO MODAL */}
      <div
        className="modal-overlay"
        id="demoModal"
        onClick={(e) => (window as any).handleModalClick(e)}
      >
        <div className="demo-modal" role="dialog" aria-modal="true" aria-labelledby="modalTitle">
          <div className="demo-header">
            <h3 id="modalTitle">
              <img
                src="/favicon.svg"
                alt="AgriSeva-AI"
                style={{
                  width: "26px",
                  height: "26px",
                  objectFit: "contain",
                  filter: "brightness(0) invert(1)",
                }}
                onError={(e) => {
                  (e.target as HTMLImageElement).src = "/logo.png";
                }}
              />
              AgriSeva-AI Agricultural Scenario Simulator
            </h3>
            <button
              className="demo-close-btn"
              onClick={() => (window as any).closeDemoModal()}
              aria-label="Close demo modal"
            >
              &times;
            </button>
          </div>
          <div className="demo-body">
            <div className="sim-grid">
              <div className="sim-controls">
                <h4>🌾 Agricultural Parameters</h4>

                <div className="sim-control-group">
                  <div className="sim-label-row">
                    <span>Rainfall Variation</span>
                    <span className="sim-val" id="valRain">
                      -15%
                    </span>
                  </div>
                  <input
                    type="range"
                    className="sim-slider"
                    id="slideRain"
                    min="-40"
                    max="40"
                    defaultValue="-15"
                    step="5"
                    onInput={() => (window as any).updateSim()}
                  />
                </div>

                <div className="sim-control-group">
                  <div className="sim-label-row">
                    <span>Irrigation Availability</span>
                    <span className="sim-val" id="valWater">
                      80%
                    </span>
                  </div>
                  <input
                    type="range"
                    className="sim-slider"
                    id="slideWater"
                    min="40"
                    max="100"
                    defaultValue="80"
                    step="5"
                    onInput={() => (window as any).updateSim()}
                  />
                </div>

                <div className="sim-control-group">
                  <div className="sim-label-row">
                    <span>Fertilizer Cost Change</span>
                    <span className="sim-val" id="valFert">
                      +20%
                    </span>
                  </div>
                  <input
                    type="range"
                    className="sim-slider"
                    id="slideFert"
                    min="-20"
                    max="60"
                    defaultValue="20"
                    step="5"
                    onInput={() => (window as any).updateSim()}
                  />
                </div>

                <div className="sim-control-group">
                  <div className="sim-label-row">
                    <span>Market Price Assumption</span>
                    <span className="sim-val" id="valPrice">
                      +5%
                    </span>
                  </div>
                  <input
                    type="range"
                    className="sim-slider"
                    id="slidePrice"
                    min="-30"
                    max="30"
                    defaultValue="5"
                    step="5"
                    onInput={() => (window as any).updateSim()}
                  />
                </div>

                <button
                  className="btn-primary"
                  style={{
                    width: "100%",
                    marginTop: "10px",
                    fontSize: "15px",
                    padding: "12px",
                  }}
                  onClick={() => (window as any).resetSim()}
                >
                  Reset to Baseline
                </button>
              </div>

              <div className="sim-results">
                <h4>📊 Simulated Agricultural Outcomes</h4>
                <div className="metric-cards">
                  <div className="metric-card">
                    <div className="m-lbl">Projected Yield</div>
                    <div className="m-val" id="resYield">
                      3.48 t/ha
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="m-lbl">Est. Revenue</div>
                    <div className="m-val" id="resRev">
                      $1,288/ha
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="m-lbl">Net Profit</div>
                    <div className="m-val green" id="resProfit">
                      $518/ha
                    </div>
                  </div>
                  <div className="metric-card">
                    <div className="m-lbl">Downside Risk</div>
                    <div className="m-val">
                      <span className="risk-badge" id="resRisk">
                        Moderate
                      </span>
                    </div>
                  </div>
                </div>
                <div className="explain-box">
                  <strong>💡 Agricultural Decision Guidance:</strong>
                  <span id="resExplain">
                    Under -15% rainfall deficit and +20% fertilizer cost, adopting a deficit irrigation regime with split-nitrogen application preserves 88% of peak profit while reducing downside risk by 22%.
                  </span>
                </div>

                <div style={{ display: "flex", gap: "8px", marginTop: "16px" }}>
                  <button
                    onClick={() => {
                      (window as any).closeDemoModal();
                      navigate({ to: user ? "/home" : "/auth" });
                    }}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      fontSize: "14px",
                      padding: "12px",
                      textDecoration: "none",
                      justifyContent: "center",
                      alignItems: "center",
                      textAlign: "center",
                      background: "var(--green-deep)",
                    }}
                  >
                    Open Platform →
                  </button>
                  <button
                    onClick={() => {
                      (window as any).closeDemoModal();
                      navigate({ to: "/auth" });
                    }}
                    className="btn-primary"
                    style={{
                      flex: 1,
                      fontSize: "14px",
                      padding: "12px",
                      textDecoration: "none",
                      justifyContent: "center",
                      alignItems: "center",
                      textAlign: "center",
                      background: "#0f172a",
                      color: "#fff",
                    }}
                  >
                    Sign In (/auth) →
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating Ask AgriSeva-AI Button */}
      <button
        onClick={() => navigate({ to: user ? "/home" : "/auth" })}
        style={{
          position: "fixed",
          bottom: "24px",
          right: "24px",
          zIndex: 99,
          display: "inline-flex",
          alignItems: "center",
          gap: "8px",
          background: "#137a4c",
          color: "#fff",
          textDecoration: "none",
          padding: "12px 20px",
          borderRadius: "999px",
          fontFamily: "'Poppins', sans-serif",
          fontSize: "13.5px",
          fontWeight: 700,
          boxShadow: "0 10px 25px rgba(19,122,76,0.35)",
          transition: "transform .2s, box-shadow .2s",
          border: "1px solid rgba(255,255,255,0.2)",
          cursor: "pointer",
        }}
      >
        <svg
          width="18"
          height="18"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M12 8V4H8" />
          <rect width="16" height="12" x="4" y="8" rx="2" />
          <path d="M2 14h2" />
          <path d="M20 14h2" />
          <path d="M15 13v2" />
          <path d="M9 13v2" />
        </svg>
        <span>Ask AgriSeva-AI</span>
      </button>
    </div>
  );
}

export default LandingPage;
