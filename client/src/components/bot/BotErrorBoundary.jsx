import { Component } from "react";
import Card from "../ui/Card";
import Button from "../ui/Button";

/**
 * Catches a render throw in a dashboard page so it shows a card instead of
 * blanking the whole app. Without it, one bad field shape from the bot API
 * unmounts the entire tree and the screen goes black with nothing to act on.
 *
 * BotShell keys this on the route path, so navigating to another tab clears a
 * caught error rather than leaving the boundary stuck.
 */
export default class BotErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    // The message is often enough to see which field the API sent in a shape the
    // page didn't expect.
    console.error("[bot dashboard] render error:", error, info?.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <Card className="p-8 text-center">
          <p className="text-sm font-semibold text-white">This screen hit an error</p>
          <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-slate-400">
            {this.state.error?.message ||
              "Something went wrong rendering this page. The rest of the dashboard is fine."}
          </p>
          <Button
            size="sm"
            className="mt-5"
            onClick={() => this.setState({ error: null })}
          >
            Try again
          </Button>
        </Card>
      );
    }
    return this.props.children;
  }
}
