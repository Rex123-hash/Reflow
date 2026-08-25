export function StoryTopology() {
  return (
    <svg
      className="story-topology"
      viewBox="0 0 1000 600"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <g data-topology="impact" className="topology-impact">
        <path data-draw pathLength="1" d="M110 515 C240 485 315 500 410 515 S640 540 890 510" />
        <path data-draw pathLength="1" className="topology-warning" d="M275 500 C360 485 420 480 515 505 S700 545 880 514" />
        {[110, 300, 500, 700, 890].map((x, index) => (
          <circle key={x} cx={x} cy={index % 2 ? 502 : 515} r="7" />
        ))}
      </g>
      <g data-topology="futures" className="topology-futures">
        <path data-draw pathLength="1" d="M500 318 C420 355 280 360 175 470" />
        <path data-draw pathLength="1" className="topology-selected" d="M500 318 C500 365 500 405 500 475" />
        <path data-draw pathLength="1" d="M500 318 C580 355 720 360 825 470" />
      </g>
      <g data-topology="selected" className="topology-selected-path">
        <path data-draw pathLength="1" d="M90 475 C240 395 285 390 385 405 S590 455 720 410" />
        <path data-draw pathLength="1" className="topology-brass" d="M165 510 C305 445 430 450 545 480" />
      </g>
      <g data-topology="failure" className="topology-failure">
        <path data-draw pathLength="1" d="M375 360 C500 330 630 335 765 400" />
        <path data-draw pathLength="1" d="M765 400 l22 -18 m-15 22 l24 8" />
        <circle cx="762" cy="399" r="9" />
      </g>
      <g data-topology="replan" className="topology-replan">
        <path data-draw pathLength="1" d="M270 470 C390 520 560 535 720 455 C780 425 830 410 900 430" />
        <circle cx="270" cy="470" r="8" />
        <circle cx="720" cy="455" r="8" />
        <circle cx="900" cy="430" r="8" />
      </g>
      <g data-topology="restored" className="topology-restored">
        <path data-draw pathLength="1" d="M175 455 C335 375 525 370 810 445" />
        <path data-draw pathLength="1" d="M240 500 C430 450 590 450 750 495" />
      </g>
    </svg>
  );
}
