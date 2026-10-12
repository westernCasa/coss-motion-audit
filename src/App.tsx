import * as React from "react";
import { Accordion, AccordionItem, AccordionPanel, AccordionTrigger } from "@/registry/default/ui/accordion";
import { AlertDialog, AlertDialogPopup, AlertDialogTitle, AlertDialogTrigger } from "@/registry/default/ui/alert-dialog";
import { Collapsible, CollapsiblePanel, CollapsibleTrigger } from "@/registry/default/ui/collapsible";
import { ContextMenu, ContextMenuItem, ContextMenuPopup, ContextMenuTrigger } from "@/registry/default/ui/context-menu";
import { Dialog, DialogPopup, DialogTitle, DialogTrigger } from "@/registry/default/ui/dialog";
import { Drawer, DrawerPopup, DrawerTitle, DrawerTrigger } from "@/registry/default/ui/drawer";
import { Menu, MenuItem, MenuPopup, MenuTrigger } from "@/registry/default/ui/menu";
import { Popover, PopoverPopup, PopoverTrigger } from "@/registry/default/ui/popover";
import { PreviewCard, PreviewCardPopup, PreviewCardTrigger } from "@/registry/default/ui/preview-card";
import { Sheet, SheetPopup, SheetTitle, SheetTrigger } from "@/registry/default/ui/sheet";
import { ToastProvider, toastManager } from "@/registry/default/ui/toast";
import { Tooltip, TooltipPopup, TooltipProvider, TooltipTrigger } from "@/registry/default/ui/tooltip";

// Each case is opened and closed through the component's own root `open` prop
// (or its real trigger where the primitive has no controlled root), so the
// measured motion is exactly what coss ships. No styles are added here.
type Name =
  | "dialog" | "dialog-bottom-stick" | "alert-dialog" | "sheet" | "drawer"
  | "popover" | "tooltip" | "preview-card" | "menu" | "context-menu"
  | "accordion" | "collapsible" | "toast";

export function App() {
  const [open, setOpen] = React.useState<Partial<Record<Name, boolean>>>({});
  const set = (n: Name, v: boolean) => setOpen((s) => ({ ...s, [n]: v }));
  const toastId = React.useRef<string | null>(null);

  React.useEffect(() => {
    (window as any).__open = (n: Name) => {
      if (n === "toast") toastId.current = toastManager.add({ title: "Saved", description: "Harness toast", timeout: 0 });
      else set(n, true);
    };
    (window as any).__close = (n: Name) => {
      if (n === "toast") { if (toastId.current) toastManager.close(toastId.current); }
      else set(n, false);
    };
    (window as any).__upsert = (type: string) => { toastManager.add({ id: "u", title: "Saved", type, timeout: 0 }); };
    (window as any).__ready = true;
  }, []);

  const o = (n: Name) => ({ open: !!open[n], onOpenChange: (v: boolean) => set(n, v) });

  return (
    <ToastProvider>
      <TooltipProvider>
        <main className="grid grid-cols-3 gap-6 p-10">
          <Dialog {...o("dialog")}><DialogTrigger>dialog</DialogTrigger><DialogPopup><DialogTitle>Dialog</DialogTitle><p className="p-6">Body</p></DialogPopup></Dialog>

          <AlertDialog {...o("alert-dialog")}><AlertDialogTrigger>alert-dialog</AlertDialogTrigger><AlertDialogPopup><AlertDialogTitle>Alert</AlertDialogTitle></AlertDialogPopup></AlertDialog>
          <Sheet {...o("sheet")}><SheetTrigger>sheet</SheetTrigger><SheetPopup><SheetTitle>Sheet</SheetTitle></SheetPopup></Sheet>
          <Drawer {...o("drawer")}><DrawerTrigger>drawer</DrawerTrigger><DrawerPopup><DrawerTitle>Drawer</DrawerTitle><p className="p-6">Body</p></DrawerPopup></Drawer>
          <Popover {...o("popover")}><PopoverTrigger>popover</PopoverTrigger><PopoverPopup>Popover body</PopoverPopup></Popover>
          <Tooltip {...o("tooltip")}><TooltipTrigger>tooltip</TooltipTrigger><TooltipPopup>Tooltip</TooltipPopup></Tooltip>
          <PreviewCard {...o("preview-card")}><PreviewCardTrigger href="#">preview-card</PreviewCardTrigger><PreviewCardPopup>Preview</PreviewCardPopup></PreviewCard>
          <Menu {...o("menu")}><MenuTrigger>menu</MenuTrigger><MenuPopup><MenuItem>One</MenuItem><MenuItem>Two</MenuItem></MenuPopup></Menu>
          <ContextMenu {...o("context-menu")}><ContextMenuTrigger className="h-16 border">context-menu</ContextMenuTrigger><ContextMenuPopup><ContextMenuItem>One</ContextMenuItem></ContextMenuPopup></ContextMenu>
          <Accordion value={open.accordion ? ["a"] : []}><AccordionItem value="a"><AccordionTrigger>accordion</AccordionTrigger><AccordionPanel><p className="py-8">Panel</p></AccordionPanel></AccordionItem></Accordion>
          <Collapsible open={!!open.collapsible}><CollapsibleTrigger>collapsible</CollapsibleTrigger><CollapsiblePanel><p className="py-8">Panel</p></CollapsiblePanel></Collapsible>
        </main>
      </TooltipProvider>
    </ToastProvider>
  );
}
