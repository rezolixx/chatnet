"use client";

import { useState, type KeyboardEvent } from "react";
import Link from "next/link";
import { Icon } from "@/components/ui/Icons";
import type { FaqCategory } from "@/components/home/HomeFaq";

export function HomeFaqClient({ categories }: { categories: readonly FaqCategory[] }) {
  const defaultOpenIds = categories.map((category) => category.items[0].id);
  const [openIds, setOpenIds] = useState<string[]>(defaultOpenIds);

  const allIds = categories.flatMap((category) => category.items.map((item) => item.id));
  const allExpanded = allIds.every((id) => openIds.includes(id));

  function toggleItem(id: string) {
    setOpenIds((current) =>
      current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]
    );
  }

  function toggleAll() {
    setOpenIds(allExpanded ? [] : allIds);
  }

  function handleTriggerKeyDown(event: KeyboardEvent<HTMLButtonElement>, currentId: string) {
    const index = allIds.indexOf(currentId);
    if (index === -1) return;

    let targetIndex = -1;
    if (event.key === "ArrowDown") targetIndex = (index + 1) % allIds.length;
    else if (event.key === "ArrowUp") targetIndex = (index - 1 + allIds.length) % allIds.length;
    else if (event.key === "Home") targetIndex = 0;
    else if (event.key === "End") targetIndex = allIds.length - 1;

    if (targetIndex !== -1) {
      event.preventDefault();
      const targetButton = document.getElementById(`${allIds[targetIndex]}-trigger`);
      targetButton?.focus();
    }
  }

  return (
    <section className="section home-faq-section" id="faq" aria-labelledby="home-faq-title">
      <div className="container">
        <div className="home-faq-header">
          <div>
            <span className="eyebrow">Questions fréquentes</span>
            <h2 id="home-faq-title">Tout savoir pour discuter sereinement sur Chatnet.fr</h2>
            <p className="home-faq-lead">
              Retrouvez les réponses aux questions les plus courantes sur l’accès invité, les salons de discussion, les comptes membres, les conversations privées et la modération.
            </p>
          </div>
          <button
            type="button"
            className="button button-outline home-faq-toggle-all"
            onClick={toggleAll}
            aria-expanded={allExpanded}
          >
            {allExpanded ? "Tout replier" : "Tout déplier"}
          </button>
        </div>

        <nav className="home-faq-categories-nav" aria-label="Catégories de la FAQ">
          {categories.map((category) => (
            <a key={category.id} href={`#faq-cat-${category.id}`} className="home-faq-category-pill">
              <Icon name={category.icon} size={16} />
              <span>{category.title}</span>
            </a>
          ))}
        </nav>

        <div className="home-faq-categories">
          {categories.map((category) => {
            const categoryHeadingId = `faq-cat-title-${category.id}`;
            return (
              <section
                key={category.id}
                id={`faq-cat-${category.id}`}
                className="home-faq-category"
                aria-labelledby={categoryHeadingId}
              >
                <div className="home-faq-category-head">
                  <div className="home-faq-category-icon">
                    <Icon name={category.icon} size={22} />
                  </div>
                  <div>
                    <h3 id={categoryHeadingId}>{category.title}</h3>
                    <p>{category.description}</p>
                  </div>
                </div>

                <div className="home-faq-accordion">
                  {category.items.map((item) => {
                    const isOpen = openIds.includes(item.id);
                    const triggerId = `${item.id}-trigger`;
                    const panelId = `${item.id}-panel`;
                    return (
                      <div
                        key={item.id}
                        className={isOpen ? "home-faq-item is-open" : "home-faq-item"}
                      >
                        <h4 className="home-faq-question">
                          <button
                            type="button"
                            id={triggerId}
                            className="home-faq-trigger"
                            aria-expanded={isOpen}
                            aria-controls={panelId}
                            onClick={() => toggleItem(item.id)}
                            onKeyDown={(event) => handleTriggerKeyDown(event, item.id)}
                          >
                            <span>{item.question}</span>
                            <span className="home-faq-chevron" aria-hidden="true">
                              <Icon name="chevron" size={18} />
                            </span>
                          </button>
                        </h4>
                        <div
                          id={panelId}
                          role="region"
                          aria-labelledby={triggerId}
                          className="home-faq-panel"
                          hidden={!isOpen}
                        >
                          <p>{item.answer}</p>
                          {item.links && item.links.length > 0 ? (
                            <div className="home-faq-links">
                              {item.links.map((link) => (
                                <Link key={link.href + link.label} href={link.href} className="text-link">
                                  {link.label} <Icon name="arrow" size={15} />
                                </Link>
                              ))}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })}
        </div>
      </div>
    </section>
  );
}
