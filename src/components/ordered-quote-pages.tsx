import { Children, isValidElement, type ReactNode } from "react";

/** Sorteert de echte React-pagina's, zodat scherm, paginanummers en PDF gelijk blijven. */
export function OrderedQuotePages({ order, children }: { order: string[]; children: ReactNode }) {
  const pages = Children.toArray(children);
  const index = (node: ReactNode) => {
    if (!isValidElement<{ "data-page"?: string }>(node)) return order.length;
    const found = order.indexOf(node.props["data-page"] ?? "");
    return found < 0 ? order.length : found;
  };
  return <div className="doc-viewer" style={{ paddingBottom: 0 }}>{pages.sort((a, b) => index(a) - index(b))}</div>;
}
