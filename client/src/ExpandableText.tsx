import { useState } from 'react';

/** Truncates long generated text with a "more/less" toggle instead of always dumping the full paragraph. */
export default function ExpandableText({
  text,
  maxLength = 90,
  className = '',
}: {
  text: string;
  maxLength?: number;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  if (text.length <= maxLength) {
    return <p className={className}>{text}</p>;
  }

  // Prefer breaking at a word boundary so the teaser doesn't cut mid-word.
  const cut = text.slice(0, maxLength);
  const teaser = cut.slice(0, cut.lastIndexOf(' ')) + '…';

  return (
    <p className={className}>
      {open ? text : teaser}{' '}
      <button type="button" className="narrative-toggle" onClick={() => setOpen((o) => !o)}>
        {open ? 'less' : 'more'}
      </button>
    </p>
  );
}
