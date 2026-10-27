export type BlogBlock =
  | { type: "paragraph" | "quote"; text: string }
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "table"; headers: string[]; rows: string[][] };

export type BlogImage = { src: string; alt: string };

export type BlogArticle = {
  slug: string;
  title: string;
  excerpt: string;
  cover: BlogImage | null;
  publishedAt: string | null;
  updatedAt: string;
  seoTitle?: string;
  seoDescription?: string;
  blocks: BlogBlock[];
};

export type BlogPage = {
  articles: BlogArticle[];
  total: number;
  lastPage: number;
  valid: boolean;
  available: boolean;
};
