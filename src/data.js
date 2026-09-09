export const starterTree = {
  id: "root",
  name: "DSA",
  type: "folder",
  children: [
    {
      id: "arrays",
      name: "Arrays & Hashing",
      type: "page",
      children: [],
      page: {
        prerequisites: [],
        problems: [
          { id: "a1", title: "Contains Duplicate", difficulty: "Easy", url: "https://leetcode.com/problems/contains-duplicate/", solved: false },
          { id: "a2", title: "Two Sum", difficulty: "Easy", url: "https://leetcode.com/problems/two-sum/", solved: false },
          { id: "a3", title: "Group Anagrams", difficulty: "Medium", url: "https://leetcode.com/problems/group-anagrams/", solved: false }
        ]
      }
    },
    {
      id: "two-pointers",
      name: "Two Pointers",
      type: "folder",
      children: [
        {
          id: "binary-search",
          name: "Binary Search",
          type: "folder",
          children: []
        },
        {
          id: "sliding-window",
          name: "Sliding Window",
          type: "folder",
          children: []
        },
        {
          id: "linked-list",
          name: "Linked List",
          type: "page",
          children: [],
          page: {
            prerequisites: ["Arrays & Hashing"],
            problems: [
              { id: "ll1", title: "Reverse Linked List", difficulty: "Easy", url: "https://leetcode.com/problems/reverse-linked-list/", solved: false },
              { id: "ll2", title: "Merge Two Sorted Lists", difficulty: "Easy", url: "https://leetcode.com/problems/merge-two-sorted-lists/", solved: false },
              { id: "ll3", title: "Reorder List", difficulty: "Medium", url: "https://leetcode.com/problems/reorder-list/", solved: false },
              { id: "ll4", title: "Merge k Sorted Lists", difficulty: "Hard", url: "https://leetcode.com/problems/merge-k-sorted-lists/", solved: false }
            ]
          }
        },
        {
          id: "other-two-pointers",
          name: "Other",
          type: "folder",
          children: []
        }
      ]
    },
    {
      id: "stack",
      name: "Stack",
      type: "folder",
      children: []
    },
    {
      id: "trees",
      name: "Trees",
      type: "folder",
      children: [
        { id: "tries", name: "Tries", type: "folder", children: [] },
        { id: "backtracking", name: "Backtracking", type: "folder", children: [] },
        { id: "graphs", name: "Graphs", type: "folder", children: [] },
        { id: "other-trees", name: "Other", type: "folder", children: [] }
      ]
    }
  ]
  ,
  links: []
};


export const aptitudeTree = {
  id: "root",
  name: "Aptitude",
  type: "folder",
  children: [
    { id: "quant", name: "Quantitative Aptitude", type: "folder", children: [
      { id: "percentages", name: "Percentages", type: "page", children: [], page: { prerequisites: [], problems: [] } },
      { id: "profit-loss", name: "Profit & Loss", type: "page", children: [], page: { prerequisites: [], problems: [] } },
      { id: "time-work", name: "Time & Work", type: "page", children: [], page: { prerequisites: [], problems: [] } },
      { id: "speed-distance", name: "Time, Speed & Distance", type: "page", children: [], page: { prerequisites: [], problems: [] } }
    ] },
    { id: "reasoning", name: "Logical Reasoning", type: "folder", children: [
      { id: "series", name: "Number Series", type: "page", children: [], page: { prerequisites: [], problems: [] } },
      { id: "coding-decoding", name: "Coding-Decoding", type: "page", children: [], page: { prerequisites: [], problems: [] } },
      { id: "blood-relations", name: "Blood Relations", type: "page", children: [], page: { prerequisites: [], problems: [] } }
    ] },
    { id: "verbal", name: "Verbal Ability", type: "folder", children: [
      { id: "grammar", name: "Grammar", type: "page", children: [], page: { prerequisites: [], problems: [] } },
      { id: "reading", name: "Reading Comprehension", type: "page", children: [], page: { prerequisites: [], problems: [] } },
      { id: "vocabulary", name: "Vocabulary", type: "page", children: [], page: { prerequisites: [], problems: [] } }
    ] },
    { id: "data-interpretation", name: "Data Interpretation", type: "folder", children: [] }
  ],
  links: []
};
