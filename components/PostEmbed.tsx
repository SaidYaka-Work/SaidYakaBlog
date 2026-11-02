import NycMarathonCalculator from '@/components/NycMarathonCalculator';

const EMBEDS: Record<string, React.ComponentType> = {
  'nyc-marathon-calculator': NycMarathonCalculator,
};

export default function PostEmbed({ id }: { id: string }) {
  const Component = EMBEDS[id];
  if (!Component) return null;
  return <Component />;
}
