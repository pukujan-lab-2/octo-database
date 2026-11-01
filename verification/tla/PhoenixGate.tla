---------------------------- MODULE PhoenixGate ----------------------------
(***************************************************************************)
(* Opening the Phoenix viewer with the Octo session (#445).                *)
(*                                                                         *)
(* POST /api/phoenix/session sets a signed, expiring cookie, but only for  *)
(* the platform owner. Each request to /phoenix/* goes through Caddy's     *)
(* forward_auth: GET /api/phoenix/auth verifies the cookie and, against    *)
(* the database, that its principal is still the platform owner. Only on a *)
(* 200 does Caddy add Phoenix's admin token and forward the request. The   *)
(* check and the forward are two steps, and the owner can be demoted or    *)
(* the cookie can expire between them.                                     *)
(***************************************************************************)
EXTENDS Naturals

CONSTANTS
    Requests,        \* requests to /phoenix/*
    RequireCheck,    \* Caddy runs forward_auth before it forwards (TRUE in the code)
    RecheckOwner     \* the auth endpoint asks the database whether the principal is still the owner (TRUE in the code)

VARIABLES
    owner,           \* the principal is the platform owner
    cookie,          \* "none", "live" or "expired"
    pc,              \* each request: "new", "passed", "done" or "refused"
    ownerAtCheck,    \* ghost: the principal was the owner when the request passed the check
    cookieAtCheck,   \* ghost: the cookie was live when the request passed the check
    liveAtForward    \* ghost: owner and a live cookie when the admin token was added

vars == <<owner, cookie, pc, ownerAtCheck, cookieAtCheck, liveAtForward>>

Init ==
    /\ owner = TRUE /\ cookie = "none"
    /\ pc = [r \in Requests |-> "new"]
    /\ ownerAtCheck = [r \in Requests |-> FALSE]
    /\ cookieAtCheck = [r \in Requests |-> FALSE]
    /\ liveAtForward = [r \in Requests |-> FALSE]

\* Only the owner mints a cookie.
Mint ==
    /\ owner /\ cookie # "live"
    /\ cookie' = "live"
    /\ UNCHANGED <<owner, pc, ownerAtCheck, cookieAtCheck, liveAtForward>>

Expire ==
    /\ cookie = "live"
    /\ cookie' = "expired"
    /\ UNCHANGED <<owner, pc, ownerAtCheck, cookieAtCheck, liveAtForward>>

Demote ==
    /\ owner
    /\ owner' = FALSE
    /\ UNCHANGED <<cookie, pc, ownerAtCheck, cookieAtCheck, liveAtForward>>

Check(r) ==
    /\ pc[r] = "new"
    /\ IF ~RequireCheck
       THEN /\ pc' = [pc EXCEPT ![r] = "passed"]
            /\ ownerAtCheck' = [ownerAtCheck EXCEPT ![r] = owner]
            /\ cookieAtCheck' = [cookieAtCheck EXCEPT ![r] = (cookie = "live")]
       ELSE IF cookie = "live" /\ (owner \/ ~RecheckOwner)
            THEN /\ pc' = [pc EXCEPT ![r] = "passed"]
                 /\ ownerAtCheck' = [ownerAtCheck EXCEPT ![r] = owner]
                 /\ cookieAtCheck' = [cookieAtCheck EXCEPT ![r] = TRUE]
            ELSE /\ pc' = [pc EXCEPT ![r] = "refused"]
                 /\ UNCHANGED <<ownerAtCheck, cookieAtCheck>>
    /\ UNCHANGED <<owner, cookie, liveAtForward>>

Forward(r) ==
    /\ pc[r] = "passed"
    /\ pc' = [pc EXCEPT ![r] = "done"]
    /\ liveAtForward' = [liveAtForward EXCEPT ![r] = (owner /\ cookie = "live")]
    /\ UNCHANGED <<owner, cookie, ownerAtCheck, cookieAtCheck>>

Next ==
    \/ Mint \/ Expire \/ Demote
    \/ \E r \in Requests : Check(r) \/ Forward(r)

Spec == Init /\ [][Next]_vars

TypeOK ==
    /\ owner \in BOOLEAN
    /\ cookie \in {"none", "live", "expired"}
    /\ pc \in [Requests -> {"new", "passed", "done", "refused"}]

\* A request that reaches Phoenix had a live cookie when it was checked.
NeedsCookie == \A r \in Requests : pc[r] \in {"passed", "done"} => cookieAtCheck[r]

\* A request that reaches Phoenix came from the platform owner when it was checked.
NeedsOwner == \A r \in Requests : pc[r] \in {"passed", "done"} => ownerAtCheck[r]

\* Stronger: the owner and a live cookie still hold when the admin token is added.
NoForwardAfterChange == \A r \in Requests : pc[r] = "done" => liveAtForward[r]
=============================================================================
