* When the page is reloaded, and a sessionId is found in localstorage, the app should know that there's a session. Right now it looks like currentStep is missing and so we don't set the session. This prevents sending messages after reloading.
* When I send a message to the agent, the agent's actual message should hbe displayed. Not stock txt like "Workflow successfully resumed"
