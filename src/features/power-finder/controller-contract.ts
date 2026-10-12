import type { FinderDataContract } from "./controller-data-contract";
import type { FinderActionsContract } from "./controller-actions-contract";
/** Composition facade; leaf sections select only the fields they need. */
export interface FinderControllerContract extends FinderDataContract, FinderActionsContract {}
