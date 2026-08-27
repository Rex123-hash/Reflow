export function StoryTopology() {
  return (
    <svg className="story-topology" aria-hidden="true">
      {["impact", "futures", "selected", "failure", "replan", "restored"].map((stage) => (
        <g key={stage} data-topology={stage} opacity="0">
          <path data-draw pathLength="1" d="M 0 0" />
        </g>
      ))}
    </svg>
  );
}
