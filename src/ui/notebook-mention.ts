/* SPDX-License-Identifier: Apache-2.0 */
import Mention from "@tiptap/extension-mention";
import type { SuggestionKeyDownProps, SuggestionProps } from "@tiptap/suggestion";
import {
  searchEntities,
  resolveEntityLabel,
  type EntityKind,
  type EntityRecord,
} from "../astro/entities";
import { createMentionPopover, type MentionPopover } from "./notebook-mention-popover";

type MentionCommandAttrs = { readonly kind: EntityKind; readonly id: string };
type MentionSuggestionProps = SuggestionProps<EntityRecord, MentionCommandAttrs>;

/**
 * Custom tiptap Mention extension for the Notebook editor.
 *
 * Persistence shape (ADR 013): mentions serialise as a `mention` node
 * with `{ kind, id }` attribute pair (overriding tiptap's default
 * `{ id, label }`). Display labels are resolved at render time via
 * `resolveEntityLabel`, so old notebooks stay correct when the
 * underlying catalogs are updated.
 */

export function createNotebookMentionExtension() {
  return Mention.extend({
    addAttributes() {
      return {
        kind: {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute("data-kind"),
          renderHTML: (attrs: Record<string, unknown>) => {
            const k = attrs["kind"];
            return typeof k === "string" ? { "data-kind": k } : {};
          },
        },
        id: {
          default: null,
          parseHTML: (el: HTMLElement) => el.getAttribute("data-id"),
          renderHTML: (attrs: Record<string, unknown>) => {
            const id = attrs["id"];
            return typeof id === "string" ? { "data-id": id } : {};
          },
        },
      };
    },
    renderText({ node }): string {
      const kind = node.attrs.kind as EntityKind | null;
      const id = node.attrs.id as string | null;
      if (kind === null || id === null) return "@?";
      const label = resolveEntityLabel({ kind, id });
      return label === null ? `@[unknown ${kind}]` : `@${label}`;
    },
  }).configure({
    HTMLAttributes: { class: "notebook-mention" },
    renderHTML({ options, node }) {
      const kind = node.attrs.kind as EntityKind | null;
      const id = node.attrs.id as string | null;
      let text: string;
      if (kind === null || id === null) {
        text = "@?";
      } else {
        const label = resolveEntityLabel({ kind, id });
        text = label === null ? `@[unknown ${kind}]` : `@${label}`;
      }
      return ["span", options.HTMLAttributes, text];
    },
    suggestion: {
      char: "@",
      items: ({ query }: { query: string }): EntityRecord[] => searchEntities(query, 8),
      render: () => {
        let popover: MentionPopover | null = null;
        return {
          onStart: (props: MentionSuggestionProps): void => {
            popover = createMentionPopover({
              items: props.items,
              clientRect: props.clientRect ?? null,
              command: props.command,
            });
          },
          onUpdate: (props: MentionSuggestionProps): void => {
            popover?.update({ items: props.items, clientRect: props.clientRect ?? null });
          },
          onKeyDown: (props: SuggestionKeyDownProps): boolean => {
            return popover?.onKeyDown(props.event) ?? false;
          },
          onExit: (): void => {
            popover?.destroy();
            popover = null;
          },
        };
      },
    },
  });
}
