
export const SCHOOL_HIERARCHY: Record<string, string[]> = {
  'Nursery': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  'Junior KG': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  'Senior KG': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  'Grade 1': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  'Grade 2': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  'Grade 3': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  'Grade 4': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  'Grade 5': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  'Grade 6': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  'Grade 7': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'],
  'Grade 8': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  'Grade 9': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
  'Grade 10': ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
};

export const RITUALS = [
  { id: 'anthem', name: 'National Anthem', icon: '🇮🇳' },
  { id: 'vande', name: 'Vande Mataram', icon: '🚩' }
];

export const GRADES_LIST = Object.keys(SCHOOL_HIERARCHY);
