package models

import "time"

type User struct {
	ID           string    `json:"user_id"`
	Username     string    `json:"username"`
	Name         string    `json:"name"`
	Surname      string    `json:"surname"`
	Email        string    `json:"email"`
	Phone        string    `json:"phone"`
	Balance      int       `json:"balance"`
	Role         string    `json:"role"`
	PasswordHash string    `json:"-"`
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type SignUpRequest struct {
	Username        string `json:"username"`
	Name            string `json:"name"`
	Surname         string `json:"surname"`
	Email           string `json:"email"`
	Phone           string `json:"phone"`
	Password        string `json:"password"`
	PasswordConfirm string `json:"password_confirm"`
}

type SignInRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Password string `json:"password"`
}

type RefreshRequest struct {
	RefreshToken string `json:"refresh_token"`
}

type AuthResponse struct {
	AccessToken  string    `json:"access_token"`
	RefreshToken string    `json:"refresh_token"`
	ExpiresIn    time.Time `json:"expires_in"`
}

type UserInfo struct {
	Username string `json:"username"`
	Name     string `json:"name"`
	Surname  string `json:"surname"`
	Email    string `json:"email"`
	Phone    string `json:"phone"`
	Role     string `json:"role"`
}

type UserUpdatePasswordRequest struct {
	Password        string `json:"password"`
	PasswordConfirm string `json:"password_confirm"`
}

type UserBalance struct {
	Amount int `json:"amount"`
}

type AdminUserInfo struct {
	ID        string    `json:"user_id"`
	Username  string    `json:"username"`
	Name      string    `json:"name"`
	Surname   string    `json:"surname"`
	Email     string    `json:"email"`
	Phone     string    `json:"phone"`
	Balance   int       `json:"balance"`
	Role      string    `json:"role"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}
