import { SOCIAL } from '@/lib/site';

const links = [
  { href: SOCIAL.githubAlt, label: 'GitHub' },
  { href: SOCIAL.linkedin, label: 'LinkedIn' },
  { href: SOCIAL.twitter, label: 'X' },
];

export default function SocialLinks({
  className = '',
}: {
  className?: string;
}) {
  return (
    <ul className={`flex flex-wrap items-center gap-x-5 gap-y-2 ${className}`}>
      {links.map((link) => (
        <li key={link.href}>
          <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-[var(--muted)] transition hover:text-[var(--ink)]"
          >
            {link.label}
          </a>
        </li>
      ))}
    </ul>
  );
}
