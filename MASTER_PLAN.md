## Clean up logging
The verbose logging is useful when debugging e2e tests. Figure out how to make it minimal in most cases. Maybe move some infos to debugs

## AST transform for making sure we await all logs in typescript
Without this, it's possible for logs to appear in the file out of order, which is annoying and makes you trust nothing.

## Add back meal management access to the app
Let users modify meals (e.g., i need to add buns to the main burger meal)