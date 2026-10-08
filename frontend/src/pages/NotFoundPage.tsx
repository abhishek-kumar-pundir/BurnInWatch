import { Link } from "react-router-dom";
import { Compass } from "lucide-react";
import { Card, EmptyState } from "../components/ui";

export default function NotFoundPage() {
  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <EmptyState
        icon={Compass}
        title="Page not found"
        description="This address does not match any BurnInWatch page."
        action={
          <Link to="/" className="text-sm font-medium text-accent underline-offset-2 hover:underline">
            Go to overview
          </Link>
        }
      />
    </Card>
  );
}
