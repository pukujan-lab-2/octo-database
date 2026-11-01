---------------------------- MODULE KeyRevocation ----------------------------
(***************************************************************************)
(* Revoking an API key, and the confirm gate on destructive actions.       *)
(*                                                                         *)
(* Revocation (DELETE /api/keys/:id) deletes the key row. A request looks  *)
(* its key up once, in authenticateRequest, and keeps that answer until it *)
(* finishes; nothing checks the key again before the write.                *)
(*                                                                         *)
(* The confirm gate (src/server/confirm.ts) refuses every API key except   *)
(* an owner agent key, which confirms on the owner's behalf. A session     *)
(* passes by typing the codes; a pass opens a window (CONFIRM_WINDOW_MS,   *)
(* two minutes, in memory) in which the same person's next gated actions  *)
(* need no codes. A restart empties the window.                            *)
(***************************************************************************)
EXTENDS Naturals

CONSTANTS
    Requests,      \* requests made with the key
    Window,        \* the window length, in clock ticks
    MaxClock

Creds == {"session", "key", "agent"}

VARIABLES
    revoked,       \* the key row is gone
    pc,            \* each key request: "new", "authed", "done", "refused"
    authedLive,    \* ghost: the key was live when the request authenticated
    wroteRevoked,  \* ghost: the request wrote after the key was revoked
    clock,
    windowUntil,   \* end of the open confirm window; 0 when none
    lastPass,      \* ghost: when a session last passed with codes; 0 when never
    keyConfirmed,  \* ghost: a plain API key got through the gate
    skippedLate    \* ghost: a session skipped codes outside Window of its last pass

vars == <<revoked, pc, authedLive, wroteRevoked, clock, windowUntil, lastPass, keyConfirmed, skippedLate>>

Init ==
    /\ revoked = FALSE
    /\ pc = [r \in Requests |-> "new"]
    /\ authedLive = [r \in Requests |-> FALSE]
    /\ wroteRevoked = [r \in Requests |-> FALSE]
    /\ clock = 1 /\ windowUntil = 0 /\ lastPass = 0
    /\ keyConfirmed = FALSE /\ skippedLate = FALSE

Unchanged_confirm == UNCHANGED <<clock, windowUntil, lastPass, keyConfirmed, skippedLate>>
Unchanged_keys == UNCHANGED <<revoked, pc, authedLive, wroteRevoked>>

-----------------------------------------------------------------------------
(* Key requests and revocation *)

Revoke ==
    /\ ~revoked /\ revoked' = TRUE
    /\ UNCHANGED <<pc, authedLive, wroteRevoked>> /\ Unchanged_confirm

Authenticate(r) ==
    /\ pc[r] = "new"
    /\ pc' = [pc EXCEPT ![r] = IF revoked THEN "refused" ELSE "authed"]
    /\ authedLive' = [authedLive EXCEPT ![r] = ~revoked]
    /\ UNCHANGED <<revoked, wroteRevoked>> /\ Unchanged_confirm

Write(r) ==
    /\ pc[r] = "authed"
    /\ pc' = [pc EXCEPT ![r] = "done"]
    /\ wroteRevoked' = [wroteRevoked EXCEPT ![r] = revoked]
    /\ UNCHANGED <<revoked, authedLive>> /\ Unchanged_confirm

-----------------------------------------------------------------------------
(* Confirm gate *)

Tick ==
    /\ clock < MaxClock /\ clock' = clock + 1
    /\ UNCHANGED <<windowUntil, lastPass, keyConfirmed, skippedLate>> /\ Unchanged_keys

Restart ==
    /\ windowUntil' = 0
    /\ UNCHANGED <<clock, lastPass, keyConfirmed, skippedLate>> /\ Unchanged_keys

\* A gated action with credential c. codes: the request sends codes that check out.
\* An owner agent key passes; a plain key is refused before anything else.
Gate(c, codes) ==
    /\ \/ /\ c = "agent"
          /\ UNCHANGED <<windowUntil, lastPass>>
       \/ /\ c = "session" /\ codes
          /\ windowUntil' = clock + Window /\ lastPass' = clock
       \/ /\ c = "session" /\ ~codes /\ clock < windowUntil
          /\ UNCHANGED <<windowUntil, lastPass>>
    /\ keyConfirmed' = (keyConfirmed \/ c = "key")
    /\ skippedLate' = (skippedLate \/ (c = "session" /\ ~codes /\ ~(lastPass > 0 /\ clock < lastPass + Window)))
    /\ UNCHANGED clock /\ Unchanged_keys

-----------------------------------------------------------------------------

Next ==
    \/ Revoke \/ Tick \/ Restart
    \/ \E r \in Requests : Authenticate(r) \/ Write(r)
    \/ \E c \in Creds, codes \in BOOLEAN : Gate(c, codes)

Spec == Init /\ [][Next]_vars

\* A revoked key never starts a request.
NoAuthAfterRevoke == \A r \in Requests : pc[r] \in {"authed", "done"} => authedLive[r]

\* Every write after revocation comes from a request that authenticated before it.
InFlightOnly == \A r \in Requests : wroteRevoked[r] => authedLive[r]

\* No write at all once the key is revoked. Expected to fail: in-flight requests finish.
NoWriteAfterRevoke == \A r \in Requests : ~wroteRevoked[r]

\* A plain API key never gets through the gate.
ApiKeyNeverConfirms == ~keyConfirmed

\* A session gets through without codes only within Window of a pass with codes.
SessionNeedsRecentPass == ~skippedLate

=============================================================================
