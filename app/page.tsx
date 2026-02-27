"use client";

import { GoogleMap, useLoadScript } from "@react-google-maps/api";
import { useState, useRef, useEffect, useCallback } from "react";

// --- [전역 타입 선언] ---
declare global {
  namespace JSX {
    interface IntrinsicElements {
      "gmp-place-autocomplete": any;
    }
  }
}

// --- [API 설정] ---
const LIBRARIES = ["places", "marker"] as const;
const GOOGLE_MAPS_API_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY!;

/* =========================================================
   🔥 장소 데이터 변환 함수
========================================================= */
async function transformPlace(place: any) {
  if (!place) return null;

  const { Place } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;

  let modernPlace = place;
  const pid = modernPlace.id || modernPlace.place_id || modernPlace.placePrediction?.placeId;

  if (pid && !(modernPlace instanceof Place)) {
    modernPlace = new Place({ id: pid });
  }

  // 1. 필요한 필드 요청
  await modernPlace.fetchFields({
    fields: [
      "displayName",
      "formattedAddress",
      "location",
      "rating",
      "userRatingCount",
      "regularOpeningHours",
      "photos",
      "internationalPhoneNumber",
      "websiteURI",
      "googleMapsURI",
      "id",
      "types",
      "utcOffsetMinutes",
    ],
  });

  // 2. 영업 상태 확인 로직
  let openStatus = false;
  try {
    openStatus = await modernPlace.isOpen();
  } catch (e) {
    openStatus = false; 
  }

  // 3. 텍스트 정보 추출
  const weekdayText = modernPlace.regularOpeningHours?.weekdayDescriptions || [];

  // 사진 URL 추출
  const firstPhoto = modernPlace.photos?.[0];
  const photoString = firstPhoto?.getURI
    ? firstPhoto.getURI({ maxWidth: 400, maxHeight: 400 })
    : null;

  return {
    place_id: modernPlace.id,
    name: modernPlace.displayName || "장소 정보",
    formatted_address: modernPlace.formattedAddress || "주소 정보 없음",
    geometry: { location: modernPlace.location },
    rating: modernPlace.rating,
    user_ratings_total: modernPlace.userRatingCount,
    opening_hours: {
      isOpen: openStatus,
      weekdayText: weekdayText,
    },
    photoUrl: photoString,
    formatted_phone_number: modernPlace.internationalPhoneNumber,
    types: modernPlace.types,
    websiteURI: modernPlace.websiteURI,
  };
}

/* =========================================================
   📍 Advanced Marker 컴포넌트
========================================================= */
function AdvancedMarker({
  map,
  position,
  onClick,
}: {
  map: google.maps.Map | null;
  position: google.maps.LatLngLiteral;
  onClick?: () => void;
}) {
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!map) return;

    const init = async () => {
      const { AdvancedMarkerElement } = (await google.maps.importLibrary("marker")) as google.maps.MarkerLibrary;

      if (!markerRef.current) {
        markerRef.current = new AdvancedMarkerElement({
          map,
          position,
        });

        if (onClick) {
          markerRef.current.addListener("click", onClick);
        }
      } else {
        markerRef.current.position = position;
      }
    };

    init();

    return () => {
      if (markerRef.current) {
        markerRef.current.map = null;
        markerRef.current = null;
      }
    };
  }, [map, position, onClick]);

  return null;
}

const containerStyle = { width: "100%", height: "100vh" };

type SavedMarker = {
  id: string;
  lat: number;
  lng: number;
  name: string;
  address?: string;
  types?: string[];
};

/* =========================================================
   🚀 메인 컴포넌트
========================================================= */
export default function Home() {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: LIBRARIES as any,
  });

  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [center, setCenter] = useState({ lat: 37.5665, lng: 126.978 });
  
  // 데이터 상태와 UI 표시 상태 분리
  const [selectedPlace, setSelectedPlace] = useState<any>(null); // 장소 데이터
  const [showDetails, setShowDetails] = useState(false);         // 카드 표시 여부

  const [savedMarkers, setSavedMarkers] = useState<SavedMarker[]>([]);
  const mapRef = useRef<google.maps.Map | null>(null);

  // 🏪 카테고리 아이콘 반환 함수
  const getCategoryIcon = (types?: string[]) => {
    if (!types || types.length === 0) return "📍";
    if (types.includes("restaurant") || types.includes("food")) return "🍽️";
    if (types.includes("cafe") || types.includes("bakery")) return "☕";
    if (types.includes("bar") || types.includes("night_club")) return "🍺";
    if (types.includes("lodging") || types.includes("hotel")) return "🏨";
    if (types.includes("tourist_attraction") || types.includes("museum")) return "📸";
    if (types.includes("shopping_mall") || types.includes("store")) return "🛍️";
    if (types.includes("park")) return "🌳";
    if (types.includes("gym") || types.includes("health")) return "💪";
    if (types.includes("hospital")) return "🏥";
    if (types.includes("school") || types.includes("university")) return "🎓";
    return "📍";
  };

  // 🕒 오늘의 영업시간 텍스트 추출 함수
  const getTodayHours = (weekdayText: string[]) => {
    if (!weekdayText || weekdayText.length === 0) return "";
    const todayIndex = new Date().getDay(); 
    const googleIndex = todayIndex === 0 ? 6 : todayIndex - 1;
    const rawText = weekdayText[googleIndex];
    if (!rawText) return "";
    return rawText.split(": ").slice(1).join(": ") || rawText;
  };

  // 📋 전화번호 복사 함수
  const handleCopyPhone = (phone: string) => {
    navigator.clipboard.writeText(phone);
    alert(`전화번호가 복사되었습니다: ${phone}`);
  };

  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setCenter({
          lat: pos.coords.latitude,
          lng: pos.coords.longitude,
        });
      });
    }

    const saved = localStorage.getItem("my_saved_places");
    if (saved) {
      setSavedMarkers(JSON.parse(saved));
    }
  }, []);

  // 🔎 검색 이벤트 핸들러
  useEffect(() => {
    if (!isLoaded) return;
    const initAutocomplete = async () => {
      const placesLib = (await google.maps.importLibrary("places")) as any;
      const PlaceAutocompleteElement = placesLib.PlaceAutocompleteElement;
      
      if (document.querySelector("gmp-place-autocomplete")) return;
      
      const autocomplete = new PlaceAutocompleteElement();
      autocomplete.placeholder = "장소를 검색해보세요";
      const container = document.getElementById("autocomplete-container");
      
      if (container) {
        container.innerHTML = "";
        container.appendChild(autocomplete);
        
        autocomplete.addEventListener("gmp-select", async (e: any) => {
          const prediction = e.placePrediction;
          if (!prediction) return;

          const place = prediction.toPlace();
          const formatted = await transformPlace(place);

          if (formatted && formatted.geometry?.location) {
            const loc = formatted.geometry.location;
            const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
            const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;

            setCenter({ lat, lng });
            mapRef.current?.panTo({ lat, lng });
            mapRef.current?.setZoom(16);

            // [변경점] 마커는 표시하되(selectedPlace 저장), 카드는 숨김(showDetails false)
            setSelectedPlace(formatted);
            setShowDetails(false); 
          }
        });
      }
    };
    initAutocomplete();
  }, [isLoaded]);

  // 🗺 지도 클릭 (빈 곳 클릭 시 초기화)
  const handleMapClick = useCallback(async (e: google.maps.MapMouseEvent) => {
    if (!mapRef.current) return;
    
    // POI(지도상 아이콘) 클릭 시 처리
    if ((e as any).placeId) {
      e.stop();
      const { Place } = (await google.maps.importLibrary("places")) as google.maps.PlacesLibrary;
      const place = new Place({ id: (e as any).placeId });
      const formatted = await transformPlace(place);
      
      setSelectedPlace(formatted);
      setShowDetails(true); // 직접 클릭했으니 정보 보여주기
    } else {
      // 빈 곳 클릭 시 선택 해제
      setSelectedPlace(null);
      setShowDetails(false);
    }
  }, []);

  const handleSavePlace = () => {
    if (!selectedPlace?.geometry?.location) return;
    const loc = selectedPlace.geometry.location;
    const newMarker: SavedMarker = {
      id: selectedPlace.place_id,
      lat: typeof loc.lat === 'function' ? loc.lat() : loc.lat,
      lng: typeof loc.lng === 'function' ? loc.lng() : loc.lng,
      name: selectedPlace.name,
      address: selectedPlace.formatted_address,
      types: selectedPlace.types,
    };
    const updated = [...savedMarkers, newMarker];
    setSavedMarkers(updated);
    localStorage.setItem("my_saved_places", JSON.stringify(updated));
  };

  const handleDeletePlace = () => {
    const updated = savedMarkers.filter((m) => m.id !== selectedPlace.place_id);
    setSavedMarkers(updated);
    localStorage.setItem("my_saved_places", JSON.stringify(updated));
    setSelectedPlace(null);
    setShowDetails(false);
  };

  if (!isLoaded) return <div style={{ padding: 20 }}>Loading...</div>;

  return (
    <div style={{ position: "relative", width: "100vw", height: "100vh", overflow: "hidden" }}>
      {/* 🔎 검색창 */}
      <div
        style={{
          position: "absolute",
          top: 20,
          left: "50%",
          transform: "translateX(-50%)",
          zIndex: 10,
          width: "90%",
          maxWidth: 400,
        }}
      >
        <div id="autocomplete-container" />
      </div>

      {/* 🗺 지도 */}
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={center}
        zoom={14}
        onLoad={(m) => {
          mapRef.current = m;
          setMap(m);
        }}
        onClick={handleMapClick}
        options={{
          mapId: "AIzaSyCIvFUn_6kp7fbK0umBs_lA9hG0TWhKYuk",
          clickableIcons: true,
          disableDefaultUI: false,
          zoomControl: true,
        }}
      >
        {/* 현재 선택된(검색된) 장소 마커 */}
        {selectedPlace?.geometry?.location && (
          <AdvancedMarker
            map={map}
            position={{
              lat: typeof selectedPlace.geometry.location.lat === 'function' 
                ? selectedPlace.geometry.location.lat() 
                : selectedPlace.geometry.location.lat,
              lng: typeof selectedPlace.geometry.location.lng === 'function' 
                ? selectedPlace.geometry.location.lng() 
                : selectedPlace.geometry.location.lng,
            }}
            // [중요] 마커 클릭 시 카드를 표시하도록 설정
            onClick={() => setShowDetails(true)}
          />
        )}

        {/* 저장된 장소 마커들 */}
        {savedMarkers.map((marker) => (
          <AdvancedMarker
            key={marker.id}
            map={map}
            position={{ lat: marker.lat, lng: marker.lng }}
            onClick={() => {
              setCenter({ lat: marker.lat, lng: marker.lng });
              // 저장된 마커 클릭 시에는 바로 정보를 보여줄지, 이동만 할지 결정
              // 여기서는 일단 이동만 하도록 둠 (원하면 로직 추가 가능)
            }}
          />
        ))}
      </GoogleMap>

      {/* 📌 정보 카드 (showDetails가 true일 때만 표시) */}
      {selectedPlace && showDetails && (
        <div
          style={{
            position: "absolute",
            bottom: "30px",
            left: "50%",
            transform: "translateX(-50%)",
            width: "90%",
            maxWidth: "400px",
            padding: "24px 20px",
            borderRadius: "16px",
            background: "white",
            boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
            zIndex: 20,
            animation: "fadeIn 0.3s ease-out",
            fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
          }}
        >
          <button
            onClick={() => setShowDetails(false)}
            style={{
              position: "absolute",
              top: 15,
              right: 15,
              border: "none",
              background: "transparent",
              fontSize: "20px",
              color: "#999",
              cursor: "pointer",
            }}
          >
            ✕
          </button>

          {/* 🖼 이미지 */}
          {selectedPlace.photoUrl && (
            <img
              src={selectedPlace.photoUrl}
              alt="place"
              style={{
                width: "100%",
                height: "160px",
                objectFit: "cover",
                borderRadius: "12px",
                marginBottom: "16px",
              }}
            />
          )}

          {/* 🏷 타이틀 */}
          <h3 style={{ margin: "0 0 4px 0", fontSize: "19px", color: "#242424", fontWeight: 700, lineHeight: 1.4 }}>
            {getCategoryIcon(selectedPlace.types)} {selectedPlace.name}
          </h3>
          
          {/* ⭐ 별점 */}
          {selectedPlace.rating && (
            <div style={{ fontSize: "14px", color: "#555", marginBottom: "12px" }}>
              <span style={{ color: "#f5a623" }}>★</span> 
              <span style={{ fontWeight: 600 }}>{selectedPlace.rating}</span>
              <span style={{ color: "#999" }}> ({selectedPlace.user_ratings_total}명)</span>
            </div>
          )}

          <hr style={{ border: "none", borderTop: "1px solid #eee", margin: "12px 0" }} />

          {/* 📍 주소 */}
          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "12px", fontSize: "14px", lineHeight: 1.5 }}>
            <span style={{ marginRight: "10px", color: "#70757a", marginTop: "2px" }}>📍</span>
            <span style={{ color: "#3c4043" }}>{selectedPlace.formatted_address}</span>
          </div>

          {/* 🕒 영업시간 */}
          <div style={{ display: "flex", alignItems: "flex-start", marginBottom: "12px", fontSize: "14px", lineHeight: 1.5 }}>
            <span style={{ marginRight: "10px", color: "#70757a", marginTop: "2px" }}>🕒</span>
            <div>
              <span
                style={{
                  fontWeight: "bold",
                  color: selectedPlace.opening_hours.isOpen ? "#188038" : "#d93025",
                  marginRight: "6px"
                }}
              >
                {selectedPlace.opening_hours.isOpen ? "영업 중" : "영업 종료"}
              </span>
              <span style={{ color: "#70757a" }}>
                 · {getTodayHours(selectedPlace.opening_hours.weekdayText)}
              </span>
            </div>
          </div>

          {/* 📞 전화번호 & 복사 */}
          {selectedPlace.formatted_phone_number && (
            <div style={{ display: "flex", alignItems: "center", marginBottom: "12px", fontSize: "14px", lineHeight: 1.5 }}>
              <span style={{ marginRight: "10px", color: "#70757a" }}>📞</span>
              <span style={{ color: "#3c4043", marginRight: "8px" }}>{selectedPlace.formatted_phone_number}</span>
              <button
                onClick={() => handleCopyPhone(selectedPlace.formatted_phone_number)}
                style={{
                  border: "1px solid #dadce0",
                  background: "white",
                  color: "#1a73e8",
                  borderRadius: "100px",
                  fontSize: "12px",
                  padding: "2px 10px",
                  cursor: "pointer",
                  fontWeight: 500
                }}
              >
                복사
              </button>
            </div>
          )}

          {/* 🔗 웹사이트 */}
           {selectedPlace.websiteURI && (
             <div style={{ display: "flex", alignItems: "center", marginBottom: "12px", fontSize: "14px" }}>
               <span style={{ marginRight: "10px", color: "#70757a" }}>🌐</span>
               <a href={selectedPlace.websiteURI} target="_blank" rel="noreferrer" style={{ color: "#1a73e8", textDecoration: "none" }}>
                 웹사이트 방문
               </a>
             </div>
           )}

          <div style={{ marginTop: "20px" }}>
            {savedMarkers.some((m) => m.id === selectedPlace.place_id) ? (
              <button
                onClick={handleDeletePlace}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#f2f2f2",
                  color: "#d93025",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  fontSize: "14px",
                  cursor: "pointer",
                }}
              >
                삭제하기
              </button>
            ) : (
              <button
                onClick={handleSavePlace}
                style={{
                  width: "100%",
                  padding: "12px",
                  backgroundColor: "#1a73e8",
                  color: "white",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: "bold",
                  fontSize: "14px",
                  cursor: "pointer",
                  boxShadow: "0 1px 2px rgba(60,64,67,0.3), 0 1px 3px 1px rgba(60,64,67,0.15)"
                }}
              >
                저장하기
              </button>
            )}
          </div>
        </div>
      )}

      <style jsx global>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translate(-50%, 20px); }
          to { opacity: 1; transform: translate(-50%, 0); }
        }
      `}</style>
    </div>
  );
}