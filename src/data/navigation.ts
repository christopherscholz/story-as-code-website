import type { SidebarItem } from '../components/Sidebar.astro';

export const schemaSidebar: SidebarItem[] = [
  { label: 'Overview', href: '/schemas/' },
  { label: 'Story', href: '/schemas/story/' },
  {
    label: 'World',
    href: '/schemas/world/',
    children: [
      { label: 'Time System', href: '/schemas/time-system/' },
      { label: 'Node', href: '/schemas/node/' },
      { label: 'Edge', href: '/schemas/edge/' },
      { label: 'Frame', href: '/schemas/frame/' },
      { label: 'Constraint', href: '/schemas/constraint/' },
    ],
  },
  {
    label: 'Narrative',
    href: '/schemas/narrative/',
    children: [
      { label: 'Lens', href: '/schemas/lens/' },
      { label: 'Format', href: '/schemas/format/' },
      { label: 'Beat', href: '/schemas/beat/' },
      { label: 'Device', href: '/schemas/device/' },
      { label: 'Thread', href: '/schemas/thread/' },
      { label: 'Variant Meta', href: '/schemas/variant-meta/' },
    ],
  },
  {
    label: 'Definitions',
    href: '/schemas/definitions/',
    children: [
      { label: 'Tag', href: '/schemas/tag/' },
      { label: 'Type', href: '/schemas/type/' },
      { label: 'Value', href: '/schemas/value/' },
    ],
  },
  {
    label: 'Derivation',
    href: '/schemas/derivation/',
    children: [
      { label: 'Rendering', href: '/schemas/rendering/' },
      { label: 'Section', href: '/schemas/section/' },
      { label: 'Passage', href: '/schemas/passage/' },
      { label: 'Derivation Meta', href: '/schemas/derivation-meta/' },
    ],
  },
];

export const exampleSidebar: SidebarItem[] = [
  { label: 'Overview', href: '/examples/' },
  {
    label: 'The Metamorphosis',
    href: '/examples/the-metamorphosis/',
    children: [
      {
        label: 'Interactive Graph',
        href: '/examples/the-metamorphosis/graph/',
      },
    ],
  },
  {
    label: 'Back to the Future',
    href: '/examples/back-to-the-future/',
    children: [
      {
        label: 'Interactive Graph',
        href: '/examples/back-to-the-future/graph/',
      },
    ],
  },
];
