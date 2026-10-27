import type { BlogBlock } from "@/lib/blog/types";

/** Text-only rendering: never interpret the legacy HTML body or inject HTML. */
export function ArticleBody({ blocks }: { blocks: readonly BlogBlock[] }) {
  return (
    <div className="chatnet-blog-prose">
      {blocks.map((block, index) => {
        switch (block.type) {
          case "paragraph": return <p key={index}>{block.text}</p>;
          case "heading": return block.level === 2 ? <h2 key={index}>{block.text}</h2> : <h3 key={index}>{block.text}</h3>;
          case "quote": return <blockquote key={index}>{block.text}</blockquote>;
          case "list": return block.ordered
            ? <ol key={index}>{block.items.map((item, idx) => <li key={idx}>{item}</li>)}</ol>
            : <ul key={index}>{block.items.map((item, idx) => <li key={idx}>{item}</li>)}</ul>;
          case "table": return (
            <div key={index} className="chatnet-blog-table-scroll">
              <table><thead><tr>{block.headers.map((text, idx) => <th key={idx} scope="col">{text}</th>)}</tr></thead>
                <tbody>{block.rows.map((row, idx) => <tr key={idx}>{row.map((text, cell) => <td key={cell}>{text}</td>)}</tr>)}</tbody></table>
            </div>
          );
        }
      })}
    </div>
  );
}
