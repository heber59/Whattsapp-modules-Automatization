# Flow definitions and publication

## Implemented contract

Endpoints under /businesses/:businessId/flows require membership. Owners/admins create, save and publish; operators read. Flows obtains membership through BusinessesService.

| Endpoint | Request / result |
| --- | --- |
| GET / | Flow summaries. |
| POST / | name, steps → flow at revision 1. |
| GET /:flowId | Draft with steps. |
| PATCH /:flowId | name, steps, expectedRevision → updated draft. |
| POST /:flowId/publish | expectedRevision → immutable publication. |
| GET /:flowId/versions/:version | Historical immutable snapshot. |

Shared types, parsing, graph validation and simulation live in packages/contracts. Portable JSON uses schemaVersion: 1, name and steps. Each step contains id, kind, text, coordinates, choices and optional config. Limits: 64 KiB, 200 steps, 20 choices per step and 4,000 text characters per step.

Implemented kinds: Start, Message, Menu, End, Input, Set, Condition, Calculate, Document, Image, Catalog, Cart, Order, Notify and Handoff. Customer fields, prices, shipping and confirmation belong to configuration. Catalog/cart are optional text-based capabilities; stock decisions belong to the business. See [scope](product-scope.md).

## Validation and versioning

Drafts may be incomplete but must satisfy structural bounds. Publication requires one Start, reachable nodes, existing labelled destinations, valid node configurations and a path to End. End has no outgoing edge; Condition has two, ordered true/false; Menu has customer choices; other nodes have one continuation. Automatic cycles are rejected; customer-input and human-approval boundaries permit controlled loops.

Saving atomically checks expectedRevision; stale changes return 409. Publication locks the draft and stores an immutable numbered snapshot transactionally. Retrying the same source revision returns its existing version. Existing conversations keep their published snapshot. Applying, publishing and assigning a channel are distinct operations.

## Programmatic authoring

Authenticated MCP exposes list/read/validate/simulate/diff/apply/publish on the same business operations. Simulation returns intended actions without external effects. Updates require revision checks; new definitions create drafts. Visual editing and JSON import/export share the runtime model. Terraform is inspiration, not a dependency.

See [operations and authoring](operations-and-authoring.md) for configuration, confirmation branches, template alerts and MCP setup, and the [shirts example](../examples/flows/configurable-shirts.json). Real-provider acceptance remains pending. Timers, arbitrary code and restricted HTTP actions are not implemented.
