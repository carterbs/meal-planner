Let's do a quick refactor. 

1. add HTTP endpoints for adding messages to the message table and for reading messages for a thread.
2. Write thorough tests for the HTTP endpoints.
3. COMMIT
4. In applyFeedbackNode, use the HTTP endpoints to add the user's feedback to the message table.
5. After getting the response from the LLM (line 632), add the userMessage (the LLM's response) to the message table.
6. In the UI, after the feedback request completes, use the HTTP endpoint to get the latest messages for the thread.
7. Update the UI with the new messages.
8. COMMIT
9. Write thorough tests for the UI.
10. COMMIT
11. Remove messages from checkpoints in the protos and in the backend code that was inserting messages into the checkpoint data. 
12. Remove messages from any type in the frontend, except the main Message type that you created/used in step 1.
13. Make sure the tests from step 9 are still passing.
14. COMMIT