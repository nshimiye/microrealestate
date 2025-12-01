## Bug

When I visit `http://localhost:8080/api-docs/#/`

And try to signup using swagger ui, I get "Method Not Allowed" error

Actual result: browser is making api call using `http://localhost:8080/landlord/signin`

Expected result: browser should make api call using `http://localhost:8080/api/v2/authenticator/landlord/signin`


