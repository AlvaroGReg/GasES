# Local Worker Polling

## Purpose

Run the worker locally to verify that it can retrieve the current gas oil C price dataset from the Ministry's Fuel Geoportal and display the received response in the console. This is the first implementation increment for the worker.

## Scope

This specification covers local development behavior only. The worker periodically requests the current-price endpoint for product `7` and prints the complete JSON response. It does not calculate or persist prices, evaluate alerts, or send notifications.

The production worker will query the current-price endpoint once every 24 hours at 23:24 UTC (`24 23 * * *`) through Railway cron. This time was selected because the first observed changed response was retrieved at 23:24 UTC. The local polling behavior in this specification is for development only.

## Data source

The worker retrieves the current dataset from:

```text
https://sedeaplicaciones.minetur.gob.es/ServiciosRESTCarburantes/PreciosCarburantes/EstacionesTerrestres/FiltroProducto/7
```

The response is the Geoportal's published dataset for land-based stations, not a home-delivery quote or a guaranteed filling price.

## Requirements

### Polling

- When started in local development mode, the worker makes its first request immediately.
- The worker continues polling at a 60-second interval until it receives a termination signal.
- A polling cycle must not overlap another cycle. If a request takes longer than 60 seconds, the next cycle starts as soon as that request finishes.
- The worker uses the current-price endpoint; it does not request historical data.

### Successful response

- For each successful HTTP response containing valid JSON, the worker prints the complete response body as formatted JSON.
- Each printed response is preceded by a timestamp recording when the worker retrieved it. This timestamp describes the local retrieval time, not the Geoportal's source-data date.
- The worker does not transform, filter, average, or otherwise interpret the response in this increment.

### Failed response

- A network error, non-success HTTP status, or invalid JSON is reported to the console with the retrieval timestamp and useful error detail.
- A failed cycle does not terminate the worker or prevent later cycles from running.
- The worker does not retry a failed request within the same cycle.
- A failed or invalid response is not printed as a successful dataset.

### Shutdown

- On a normal termination signal, the worker stops scheduling new polling cycles and exits cleanly.
- Shutdown does not initiate another request.

## Acceptance scenarios

### Immediate first retrieval

**Given** the worker is started in local development mode  
**When** it initializes  
**Then** it requests the current gas oil C dataset without waiting for the first 60-second interval.

### Repeated retrieval

**Given** the worker is running and requests complete in less than 60 seconds  
**When** 60 seconds elapse between polling cycles  
**Then** it requests the endpoint again and prints the full JSON response with a retrieval timestamp.

### Slow retrieval does not overlap

**Given** a request takes longer than 60 seconds  
**When** that request is still in progress at the next polling interval  
**Then** the worker does not start a concurrent request and starts the next cycle after the active request finishes.

### Recoverable request failure

**Given** a request fails, returns a non-success status, or contains invalid JSON  
**When** the cycle completes  
**Then** the worker prints an error with its retrieval timestamp and continues polling in subsequent cycles.

### Clean shutdown

**Given** the worker is polling  
**When** it receives a normal termination signal  
**Then** it schedules no further cycles and exits cleanly.

## Out of scope

- National or provincial average calculations.
- Data persistence, database access, or historical storage.
- Alert evaluation, subscriptions, and email delivery.
- API or frontend behavior.
- Production scheduling implementation or changes to the daily 23:24 UTC Railway cron.
- Source freshness validation beyond checking that the response is successful JSON.
