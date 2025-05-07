type StateCallback = (state: boolean) => void;
type StateEdgeCallback = (edge: Edge, state: boolean) => void;
type HandlerCallback = (pin: number, state: boolean) => Promise<boolean>;
type Callback = () => void;
