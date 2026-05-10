interface AiPanelProps {
  title?: string;
  micro?: string;
  children: React.ReactNode;
}

export default function AiPanel({
  title = "AI assistant",
  micro,
  children,
}: AiPanelProps) {
  return (
    <div className="foi-ai-panel">
      <div className="foi-ai-head">
        <span className="foi-ai-glyph" aria-hidden="true">★</span>
        <h4>{title}</h4>
        {micro && <span className="foi-ai-micro">{micro}</span>}
      </div>
      <div className="foi-ai-body">{children}</div>
    </div>
  );
}
