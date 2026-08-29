import { Fragment, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { SiteHeader } from "../components/SiteHeader";
import { ReflowRule } from "../components/ReflowRule";
import { FAQ_SECTIONS, type FaqEntry } from "./faqContent";
import "./faq.css";

/**
 * Renders an answer, promoting `backticked` spans to identifiers.
 *
 * Answers are authored as plain sentences rather than as markup, because the
 * content module is meant to stay editable by someone who is not editing JSX. The
 * only formatting the copy needs is the one Reflow's language actually uses: an
 * exact machine value set apart from the prose around it.
 */
function Answer({ text }: { text: string }) {
  const parts = text.split(/(`[^`]+`)/g);
  return (
    <p>
      {parts.map((part, index) =>
        part.startsWith("`") && part.endsWith("`") ? (
          <code key={index}>{part.slice(1, -1)}</code>
        ) : (
          <Fragment key={index}>{part}</Fragment>
        ),
      )}
    </p>
  );
}

/**
 * One question.
 *
 * A native `<details>`: keyboard reachable, findable by the browser's own in-page
 * search when open, and correct with no JavaScript at all. The chevron is CSS on
 * the marker rather than an animated icon — the disclosure communicates state, and
 * nothing here needs to move to say so.
 */
function Question({ entry, index }: { entry: FaqEntry; index: number }) {
  return (
    <details className="faq-q">
      <summary>
        <span className="faq-q-index">
          {String(index + 1).padStart(2, "0")}
        </span>
        <span className="faq-q-text">{entry.q}</span>
        <span className="faq-q-chevron" aria-hidden="true" />
      </summary>
      <div className="faq-a">
        {entry.a.map((paragraph, i) => (
          <Answer key={i} text={paragraph} />
        ))}
      </div>
    </details>
  );
}

/**
 * The recovery loop, drawn flat.
 *
 * A two-dimensional echo of the instrument the story surface renders in WebGL: one
 * orbit, seven stations, the two that can repeat joined by the return arc that
 * makes Reflow's argument — a recovery is a loop, not a line, and the second lap is
 * the interesting one. Static by design; it is a diagram, not an animation, and it
 * carries a text alternative rather than relying on being seen.
 */
function LoopDiagram() {
  const stages = [
    "Detect",
    "Impact",
    "Plan",
    "Act",
    "Verify",
    "Replan",
    "Restored",
  ];
  const radius = 104;
  const centre = 150;
  const angleOf = (index: number) =>
    (index / stages.length) * Math.PI * 2 - Math.PI / 2;
  const planAngle = angleOf(stages.indexOf("Plan"));
  const replanAngle = angleOf(stages.indexOf("Replan"));

  return (
    <figure className="faq-loop">
      <svg viewBox="0 0 300 300" role="img" aria-labelledby="faq-loop-title">
        <title id="faq-loop-title">
          The recovery loop: detect, impact, plan, act, verify, then either
          restored or replan, which returns to plan.
        </title>
        <circle
          cx={centre}
          cy={centre}
          r={radius}
          className="faq-loop-orbit"
          fill="none"
        />
        {/* The return: replan back to plan, drawn before the core so it reads as
            passing behind the instrument rather than across its face. The caption
            claims this edge exists, so the diagram has to show it. */}
        <path
          d={`M ${centre + Math.cos(replanAngle) * radius} ${centre + Math.sin(replanAngle) * radius} L ${centre + Math.cos(planAngle) * radius} ${centre + Math.sin(planAngle) * radius}`}
          className="faq-loop-return"
        />
        <path
          d={`M ${centre + Math.cos(planAngle) * radius - 13} ${centre + Math.sin(planAngle) * radius - 5} l 7 5 l -7 5`}
          className="faq-loop-return-head"
        />
        <circle cx={centre} cy={centre} r={34} className="faq-loop-core" />
        <circle cx={centre} cy={centre} r={9} className="faq-loop-pip" />
        {stages.map((stage, index) => {
          // Starts at the top and runs clockwise, so the reading order on the
          // page and the order on the ring are the same order.
          const angle = angleOf(index);
          const x = centre + Math.cos(angle) * radius;
          const y = centre + Math.sin(angle) * radius;
          const labelX = centre + Math.cos(angle) * (radius + 22);
          const labelY = centre + Math.sin(angle) * (radius + 22);
          const isTerminal = stage === "Restored";
          return (
            <g key={stage}>
              <circle
                cx={x}
                cy={y}
                r={isTerminal ? 6.5 : 5}
                className={
                  isTerminal ? "faq-loop-node is-terminal" : "faq-loop-node"
                }
              />
              <text
                x={labelX}
                y={labelY}
                className="faq-loop-label"
                textAnchor={
                  Math.abs(Math.cos(angle)) < 0.3
                    ? "middle"
                    : Math.cos(angle) > 0
                      ? "start"
                      : "end"
                }
                dominantBaseline="middle"
              >
                {stage.toUpperCase()}
              </text>
            </g>
          );
        })}
      </svg>
      <figcaption>
        Seven stages on one orbit. <b>Replan</b> returns to <b>Plan</b>, and the
        loop runs again as Recovery&nbsp;02.
      </figcaption>
    </figure>
  );
}

/** Three sentences, for a reader who will not read the other forty. */
function Primer() {
  return (
    <section className="faq-primer" aria-labelledby="faq-primer-title">
      <div className="faq-primer-copy">
        <p className="eyebrow">In one minute</p>
        <ReflowRule />
        <h2 id="faq-primer-title">
          Reflow protects an outcome, and proves what it did to protect it.
        </h2>
        <p>
          You name something that has to happen by a date that cannot move. When
          something threatens it, Reflow works out what broke, plans a way
          around it, acts in your real tools, and then reads the world back to
          check the plan actually landed.
        </p>
        <p>
          If the check fails, it says so and tries again. Every step is recorded
          as evidence you can read afterwards, in order, with the exact values
          it observed.
        </p>
        <dl className="faq-primer-facts">
          <div>
            <dt>What it protects</dt>
            <dd>An objective with a deadline it may not move</dd>
          </div>
          <div>
            <dt>What it runs</dt>
            <dd>Exactly eight agents, on gemini-3.7-flash</dd>
          </div>
          <div>
            <dt>What it leaves behind</dt>
            <dd>A durable, verifiable record of every action</dd>
          </div>
        </dl>
      </div>
      <LoopDiagram />
    </section>
  );
}

export function FaqPage() {
  const [open, setOpen] = useState<string | null>(null);
  const total = useMemo(
    () => FAQ_SECTIONS.reduce((sum, section) => sum + section.entries.length, 0),
    [],
  );

  return (
    <div className="site-shell faq-shell" id="top">
      <SiteHeader current="faq" />
      <main className="faq-main">
        <header className="faq-hero">
          <p className="eyebrow">Questions</p>
          <ReflowRule />
          <h1>
            Everything worth asking
            <br />
            before you trust it.
          </h1>
          <p className="faq-hero-lede">
            Reflow acts on your behalf in systems that matter. That earns a
            straight account of what it is, how it works, and — just as
            carefully — what it refuses to do.
          </p>
          <p className="faq-hero-meta">
            <span>{total} questions</span>
            <i aria-hidden="true" />
            <span>{FAQ_SECTIONS.length} sections</span>
            <i aria-hidden="true" />
            <span>No marketing answers</span>
          </p>
        </header>

        <Primer />

        <nav className="faq-index" aria-label="Sections">
          {FAQ_SECTIONS.map((section) => (
            <a
              key={section.id}
              href={`#faq-${section.id}`}
              onFocus={() => setOpen(section.id)}
              onMouseEnter={() => setOpen(section.id)}
              className={open === section.id ? "is-hovered" : undefined}
            >
              <span className="faq-index-title">{section.title}</span>
              <span className="faq-index-count">
                {section.entries.length}
              </span>
            </a>
          ))}
        </nav>

        {FAQ_SECTIONS.map((section) => (
          <section
            key={section.id}
            className="faq-section"
            id={`faq-${section.id}`}
            aria-labelledby={`faq-${section.id}-title`}
          >
            <div className="faq-section-head">
              <p className="eyebrow">{section.eyebrow}</p>
              <ReflowRule />
              <h2 id={`faq-${section.id}-title`}>{section.title}</h2>
              <p className="faq-section-blurb">{section.blurb}</p>
            </div>
            <div className="faq-list">
              {section.entries.map((entry, index) => (
                <Question key={entry.q} entry={entry} index={index} />
              ))}
            </div>
          </section>
        ))}

        <section className="faq-cta">
          <p className="eyebrow">Still the best answer</p>
          <ReflowRule />
          <h2>Read a real recovery instead.</h2>
          <p>
            The workspace opens on a recorded incident you can follow end to
            end — including the attempt that failed.
          </p>
          <Link className="button button-primary" to="/app">
            Open live workspace <span aria-hidden="true">→</span>
          </Link>
        </section>
      </main>
    </div>
  );
}

export default FaqPage;
