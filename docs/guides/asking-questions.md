# Asking the user questions

An agent can ask the operator one or more questions as a form instead of plain text. In the chat view the
form shows lettered options, a "Recommended" tag, an "Other / none of these" row and an optional note. The
operator's choices go back to that agent as an ordinary message.

## Format

Write a fenced block tagged `questions` containing JSON:

````
```questions
{
  "title": "Before I fix expired coupons",
  "questions": [
    {
      "id": "q1",
      "text": "What should the shopper see for an expired code?",
      "options": [
        { "label": "Inline error under the coupon field", "detail": "This code expired on Jun 1.", "recommended": true },
        { "label": "A toast at the top of the page" }
      ]
    },
    {
      "text": "Add a test for it?",
      "options": [{ "label": "Yes, in tests/coupons.test.ts", "recommended": true }, { "label": "No" }]
    }
  ]
}
```
````

- `title` and each question's `id` are optional. A missing `id` becomes `q1`, `q2`, and so on.
- Up to 10 questions per form and 8 options per question. Every question needs at least one option.
- A block that is not valid JSON, or has no usable question, is shown as plain text.

## The reply

The agent receives one message:

```
Answers to "Before I fix expired coupons":
q1 (What should the shopper see for an expired code?): Inline error under the coupon field - keep it short
q2 (Add a test for it?): unanswered
```

A question the operator did not choose an option for is `unanswered`. "Other / none of these" is `Other`,
followed by the note when there is one.

Once an answer to a form with the same title is in the conversation, the card shows as answered.
