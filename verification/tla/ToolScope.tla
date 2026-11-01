------------------------------ MODULE ToolScope ------------------------------
(***************************************************************************)
(* MCP tool visibility against a key's current scopes (#442, #445).        *)
(*                                                                         *)
(* On connect, restrictToCapabilities hides every tool the key's scopes    *)
(* do not allow. The agent keeps that tool list for the session. A key's   *)
(* scopes can be narrowed afterwards (PATCH /api/keys/:id). Every tool     *)
(* call goes to an API route that checks the key's scopes again.           *)
(*                                                                         *)
(* A key holds "read" or "write". record_eval_scores and                   *)
(* enable_ux_analytics need "write"; read_traces and read_ux_analytics     *)
(* need "read". A write tool is only listed to a key that had "write"      *)
(* when the agent connected.                                               *)
(***************************************************************************)
EXTENDS Naturals

CONSTANTS
    Calls,           \* tool calls made in the session
    ApiChecks        \* the API route checks the key's current scopes on every call (TRUE in the code)

VARIABLES
    hasWrite,        \* the key currently holds the write scope
    listedWrite,     \* the write tools were listed when the agent connected
    pc,              \* each call: "new", "wrote" or "refused"
    wroteWithout     \* ghost: the call wrote after the key lost write

vars == <<hasWrite, listedWrite, pc, wroteWithout>>

Init ==
    /\ hasWrite \in BOOLEAN
    /\ listedWrite = hasWrite
    /\ pc = [c \in Calls |-> "new"]
    /\ wroteWithout = [c \in Calls |-> FALSE]

\* The key is edited down; it is never widened by an edit that an agent can make.
Narrow ==
    /\ hasWrite
    /\ hasWrite' = FALSE
    /\ UNCHANGED <<listedWrite, pc, wroteWithout>>

Call(c) ==
    /\ pc[c] = "new"
    /\ listedWrite                         \* the agent only calls a tool it was shown
    /\ IF ApiChecks /\ ~hasWrite
       THEN /\ pc' = [pc EXCEPT ![c] = "refused"]
            /\ UNCHANGED wroteWithout
       ELSE /\ pc' = [pc EXCEPT ![c] = "wrote"]
            /\ wroteWithout' = [wroteWithout EXCEPT ![c] = ~hasWrite]
    /\ UNCHANGED <<hasWrite, listedWrite>>

Next == Narrow \/ \E c \in Calls : Call(c)

Spec == Init /\ [][Next]_vars

\* No write happens with a key that no longer holds the write scope.
NoWriteWithoutScope == \A c \in Calls : pc[c] = "wrote" => ~wroteWithout[c]
=============================================================================
