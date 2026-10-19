package dev.imjaewoo.gonggo.announcement.model;

/** 주최기관. address가 없으면 null로 내려 준다(웹 계약) */
public record Organizer(String name, String address, String color) {
}
