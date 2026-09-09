"use client";

import { useCallback, useState } from "react";
import type { Editor } from "@tiptap/react";

import { LinkButton, useLinkPopover } from "@/components/tiptap-ui/link-popover";
import { CornerDownLeftIcon } from "@/components/tiptap-icons/corner-down-left-icon";
import { TrashIcon } from "@/components/tiptap-icons/trash-icon";
import { Button } from "@/components/tiptap-ui-primitive/button";
import { ButtonGroup } from "@/components/tiptap-ui-primitive/button-group";
import { Card, CardBody, CardItemGroup } from "@/components/tiptap-ui-primitive/card";
import { Input } from "@/components/tiptap-ui-primitive/input";
import { Separator } from "@/components/tiptap-ui-primitive/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/tiptap-ui-primitive/popover";

interface Props {
  editor: Editor | null;
  /**
   * Template variables offered as link addresses, already brace-wrapped
   * (`{{case_url}}`). The first is used to prefill an empty address box.
   */
  urlVariables?: string[];
}

/**
 * Link popover with template-variable support.
 *
 * Tiptap's own `LinkPopover` cannot do this: it owns the address state inside
 * `useLinkPopover`, and `LinkMain` — the piece that renders the field — is not
 * exported, so there is no way to seed the box from outside. The component's
 * own docblock points here, at the hook, for exactly this reason.
 *
 * So the hook does the link work and this owns the presentation, reusing the
 * vendored primitives rather than new markup so the GDS overrides in
 * _foi-extensions.scss keep applying and nothing in the vendored tree is edited.
 *
 * Why prefill matters: the variable chip bar writes into the document body, not
 * into this field, and the popover covers the chip bar while it is open — so
 * without this the address has to be typed from memory.
 *
 * The offered variables are the ones for the template's own purpose, which is
 * what stops a consultation template being given {{case_url}} — a variable that
 * is not in its render context and would reach the assignee unsubstituted.
 */
export default function EditorLinkPopover({ editor, urlVariables = [] }: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const {
    isVisible, canSet, isActive,
    url, setUrl, setLink, removeLink,
    label, Icon,
  } = useLinkPopover({ editor });

  const handleOpenChange = useCallback((next: boolean) => {
    setIsOpen(next);
    // Seed an empty box on open. `url` mirrors the selection's existing href,
    // so an empty string here means "not currently a link" rather than "not
    // loaded yet", and an existing link is never overwritten.
    if (next && !url && urlVariables.length > 0) {
      setUrl(urlVariables[0]);
    }
  }, [url, setUrl, urlVariables]);

  const handleSetLink = useCallback(() => {
    setLink();
    setIsOpen(false);
  }, [setLink]);

  if (!isVisible) return null;

  return (
    <Popover open={isOpen} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <LinkButton
          disabled={!canSet}
          data-active-state={isActive ? "on" : "off"}
          data-disabled={!canSet}
          aria-label={label}
          aria-pressed={isActive}
          onClick={() => handleOpenChange(!isOpen)}
        >
          <Icon className="tiptap-button-icon" />
        </LinkButton>
      </PopoverTrigger>

      <PopoverContent collisionPadding={4}>
        <Card>
          <CardBody>
            <CardItemGroup orientation="horizontal">
              <label className="govuk-visually-hidden" htmlFor="foi-link-address">
                Link address
              </label>
              <Input
                id="foi-link-address"
                type="text"
                placeholder="https://…"
                value={url}
                onChange={e => setUrl(e.target.value)}
                onKeyDown={e => {
                  if (e.key === "Enter") { e.preventDefault(); handleSetLink(); }
                }}
                autoFocus
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                className="tiptap-link-input"
              />

              <ButtonGroup>
                <Button
                  type="button"
                  onClick={handleSetLink}
                  title="Apply link"
                  disabled={!url && !isActive}
                  variant="ghost"
                >
                  <CornerDownLeftIcon className="tiptap-button-icon" />
                </Button>
              </ButtonGroup>

              <Separator />

              <ButtonGroup>
                <Button
                  type="button"
                  onClick={() => { removeLink(); setIsOpen(false); }}
                  title="Remove link"
                  disabled={!isActive}
                  variant="ghost"
                >
                  <TrashIcon className="tiptap-button-icon" />
                </Button>
              </ButtonGroup>
            </CardItemGroup>

            {/* Tiptap's "open in new window" button is deliberately dropped: it
                routes through sanitizeUrl, which returns "#" for a {{variable}},
                so on these templates it is a control that can only no-op. */}
            {urlVariables.length > 0 && (
              <div className="foi-link-popover__variables">
                <span className="govuk-hint govuk-!-margin-bottom-0">Insert:</span>
                {urlVariables.map(v => (
                  <button
                    key={v}
                    type="button"
                    className="foi-editor__chip foi-mono"
                    title={`Use ${v} as the address`}
                    onClick={() => setUrl(v)}
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      </PopoverContent>
    </Popover>
  );
}
